#!/usr/bin/env bash
#
# Description
# ===========
#
# Deploys main to staging or production:
#   1. Shows the commits about to be pushed (and, on staging, removed)
#   2. Ask for confirmation (exit with 1 if not confirming)
#   3. Notify Slack
#   4. Pushes the commit that was previewed
#
#
# Developing
# ==========
#
# During development, the best way to test it is to call the script
# directly with `./scripts/deploy.sh production` and answer no. You can also set
# the `SLACK_CHANNEL` to your personnal channel so you don't flood the team.
# To do that, right click on your own name in Slack, `Copy link`, then
# only keep the last part of the URL.
#
# Or you can set `PUSH_TO_SLACK` to false to echo the payload instead of
# sending it.
#
# ------------------------------------------------------------------------------

if [ "$#" -ne 1 ]; then
  echo "Usage: [DEPLOY_MSG='An optional custom deploy message'] $0 production"
  exit 1
fi

# ---- Variables ----

# No staging app: production only
if [ "$1" == "production" ]; then
  HEROKU_APP="contributors-svg"
  DEPLOY_ORIGIN_URL="https://git.heroku.com/contributors-svg.git"
else
  echo "Unknwown remote $1"
  exit 1
fi

# Defaults, which the environment can override (see Developing above)
PUSH_TO_SLACK=${PUSH_TO_SLACK:-true} # false echoes the message instead of pushing it to Slack
SLACK_CHANNEL=${SLACK_CHANNEL:-"CEZUS9WH3"}

PRE_DEPLOY_ORIGIN="predeploy-${1}"

LOCAL_BRANCH="main"
PRE_DEPLOY_BRANCH="main"

GIT_LOG_FORMAT_SHELL='short'
GIT_LOG_FORMAT_SLACK='format:<https://github.com/opencollective/contributors-svg/commit/%H|[%ci]> *%an* %n_%<(80,trunc)%s_%n'
DEPLOY_ENV="$1"

# ---- Utils ----

function confirm()
{
  echo -n "$@"
  read -e answer
  for response in y Y yes YES Yes Sure sure SURE OK ok Ok
  do
      if [ "$answer" == "$response" ]
      then
          return 0
      fi
  done

  # Any answer other than the list above is considerred a "no" answer
  return 1
}

# Push the local commit that was previewed, straight to the app's URL (not
# the remote, which could have a push URL of its own). Staging's push is forced, and
# leased on the state previewed: a deploy made meanwhile isn't overwritten
function deploy()
{
  echo "🚀  Deploying now..."
  if [ "$DEPLOY_ENV" == "staging" ]; then
    git push --force-with-lease="$PRE_DEPLOY_BRANCH:$REMOTE_OID" \
      "$DEPLOY_ORIGIN_URL" "$LOCAL_OID:refs/heads/$PRE_DEPLOY_BRANCH"
  else
    git push "$DEPLOY_ORIGIN_URL" "$LOCAL_OID:refs/heads/$PRE_DEPLOY_BRANCH"
  fi
  exit $?
}

# ---- Ensure we have a reference to the remote ----

# Added the first time, and reset if it points anywhere else: the fetch and
# the push go to this remote
if ! git remote add "$PRE_DEPLOY_ORIGIN" "$DEPLOY_ORIGIN_URL" 2> /dev/null; then
  git remote set-url "$PRE_DEPLOY_ORIGIN" "$DEPLOY_ORIGIN_URL" || exit 1
fi

# ---- Show the commits about to be pushed ----

# Update deploy remote
echo "ℹ️  Fetching remote $1 state..."
# Without the current state, the commits shown would be wrong: stop here
if ! git fetch $PRE_DEPLOY_ORIGIN $PRE_DEPLOY_BRANCH > /dev/null; then
  echo "⚠️  Couldn't fetch $1's state, not deploying."
  exit 1
fi
# The commits previewed, kept in this run's variables: the push below uses
# them, whatever a fetch, a commit or another run changes meanwhile
# Fully qualified: a tag named main would win over the branch otherwise
REMOTE_OID=$(git rev-parse --verify --quiet "refs/remotes/$PRE_DEPLOY_ORIGIN/$PRE_DEPLOY_BRANCH^{commit}")
LOCAL_OID=$(git rev-parse --verify --quiet "refs/heads/$LOCAL_BRANCH^{commit}")
if [ -z "$REMOTE_OID" ] || [ -z "$LOCAL_OID" ]; then
  echo "⚠️  Couldn't find $LOCAL_BRANCH locally or on $1, not deploying."
  exit 1
fi

# After `heroku rollback`, the app runs an older release while Heroku's git
# main stays at the last push: the changelog would start from the wrong
# commit, and pushing the same main wouldn't redeploy anything. The running
# commit is the one of the "Deploy <sha>" release that built the current slug
if command -v heroku > /dev/null; then
  RUNNING=$(
    heroku releases -a "$HEROKU_APP" -n 100 --json 2> /dev/null | node -e '
      let data = "";
      process.stdin.on("data", (chunk) => (data += chunk)).on("end", () => {
        try {
          const releases = JSON.parse(data);
          const current = releases.find((release) => release.current);
          const deploy = releases.find(
            (release) =>
              current && release.slug && current.slug &&
              release.slug.id === current.slug.id &&
              /^Deploy [0-9a-f]+$/.test(release.description)
          );
          console.log(deploy ? deploy.description.split(" ")[1] : "");
        } catch (err) {}
      });
    '
  )
  if [ -z "$RUNNING" ]; then
    # Not in the last 100 releases (rolled back far), or the CLI failed:
    # assuming Heroku's main could deploy from the wrong state
    echo "⚠️  Couldn't find the commit $HEROKU_APP runs (see \`heroku releases -a $HEROKU_APP\`): not deploying."
    exit 1
  elif [[ "$REMOTE_OID" != "$RUNNING"* ]]; then
    echo "⚠️  $HEROKU_APP runs $RUNNING (rolled back?), not ${REMOTE_OID:0:8} from Heroku's main: not deploying."
    echo "   Roll forward with \`heroku rollback -a $HEROKU_APP <version>\`, or push explicitly."
    exit 1
  fi
else
  echo "ℹ️  No heroku CLI: can't check whether $1 was rolled back."
fi

if [ "$LOCAL_OID" == "$REMOTE_OID" ]; then
  echo "ℹ️  $1 already has $LOCAL_BRANCH (${LOCAL_OID:0:8}): nothing to deploy."
  exit 0
fi
# What the deploy adds
GIT_LOG_COMPARISON="$REMOTE_OID..$LOCAL_OID"
# Commits only on the deployed branch: a forced push (staging) removes them
GIT_LOG_REMOVED="$LOCAL_OID..$REMOTE_OID"

echo ""
echo "-------------- New commits --------------"
git --no-pager log --pretty="${GIT_LOG_FORMAT_SHELL}" $GIT_LOG_COMPARISON
echo "-----------------------------------------"
if [ -n "$(git log --oneline $GIT_LOG_REMOVED)" ]; then
  # Production isn't force-pushed: its push would be rejected
  if [ "$DEPLOY_ENV" != "staging" ]; then
    echo "⚠️  $1 has commits your main doesn't (below): update main first, not deploying."
    git --no-pager log --pretty="${GIT_LOG_FORMAT_SHELL}" $GIT_LOG_REMOVED
    exit 1
  fi
  echo ""
  echo "--------- Commits removed from $1 ---------"
  git --no-pager log --pretty="${GIT_LOG_FORMAT_SHELL}" $GIT_LOG_REMOVED
  echo "-----------------------------------------"
fi
echo ""

# ---- Ask for confirmation ----

echo "ℹ️  You're about to deploy the preceding commits from main branch to $1 server."
confirm "❔ Are you sure (yes/no) > " || exit 1

# ---- Slack notification ----

cd -- "$(dirname $0)/.."
eval $(cat .env | grep OC_SLACK_DEPLOY_WEBHOOK=)

if [ ! -z "$DEPLOY_MSG" ]; then
  CUSTOM_MESSAGE="-- _${DEPLOY_MSG}_"
fi

# Built by a JSON encoder: the changelog spans several lines, and quotes in
# it or in the message must be escaped
PAYLOAD=$(
  SLACK_CHANNEL="$SLACK_CHANNEL" \
  TEXT=":rocket: Deploying *Contributors SVG* to *${1}* ($(git config user.name)) ${CUSTOM_MESSAGE}" \
  CHANGELOG="$(git log --pretty="${GIT_LOG_FORMAT_SLACK}" $GIT_LOG_COMPARISON)" \
  REMOVED="$(git log --pretty="${GIT_LOG_FORMAT_SLACK}" $GIT_LOG_REMOVED)" \
  node -e '
    const { SLACK_CHANNEL, TEXT, CHANGELOG, REMOVED } = process.env;
    const removed = REMOVED ? `\n*Removed:*\n\n${REMOVED}\n` : "";
    console.log(JSON.stringify({
      channel: SLACK_CHANNEL,
      text: TEXT,
      as_user: true,
      attachments: [
        { text: `${"-".repeat(99)}\n\n${CHANGELOG}\n${removed}` },
      ],
    }));
  '
)

if [ "$PUSH_TO_SLACK" != "true" ]; then
  echo "Following message would be posted on Slack:"
  echo "$PAYLOAD"
elif [ -z "$OC_SLACK_DEPLOY_WEBHOOK" ]; then
  # A warning, not an error: the deploy goes on without the Slack webhook.
  # Get one on https://api.slack.com/custom-integrations/legacy-tokens
  echo "ℹ️  OC_SLACK_DEPLOY_WEBHOOK is not set, I will not notify Slack about this deploy 😞  (please do it manually)"
else
  curl \
    -H "Content-Type: application/json; charset=utf-8" \
    -d "$PAYLOAD" \
    -s \
    --fail \
    "$OC_SLACK_DEPLOY_WEBHOOK" \
    &> /dev/null

  if [ $? -ne 0 ]; then
    echo "⚠️  I won't be able to notify slack. Please do it manually and check your OC_SLACK_DEPLOY_WEBHOOK"
  else
    echo "🔔  Slack notified about this deployment."
  fi
fi

# Deploy even if the Slack notification failed
deploy
