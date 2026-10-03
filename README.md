# Contributors SVG

[![Dependency Status](https://david-dm.org/opencollective/contributors-svg/status.svg)](https://david-dm.org/opencollective/contributors-svg)

## Foreword

If you see a step below that could be improved (or is outdated), please update the instructions. We rarely go through this process ourselves, so your fresh pair of eyes and your recent experience with it, makes you the best candidate to improve them for other users. Thank you!

## Development

### Prerequisite

1. Make sure you have Node.js version 24 and npm 11, the ones used in CI and production.

- We recommend using [nvm](https://github.com/creationix/nvm): `nvm install && nvm use`.

### Install

We recommend cloning the repository in a folder dedicated to `opencollective` projects.

```
git clone git@github.com:opencollective/contributors-svg.git opencollective/contributors-svg
cd opencollective/contributors-svg
npm install
```

### Environment variables

This project requires an access to the Open Collective API.

By default, it will try to connect to the Open Colllective staging API, **you don't have to change anything**.

If case you want to connect to the Open Collective API running locally:

- clone, install and start [opencollective-api](https://github.com/opencollective/opencollective-api)
- in this project, copy [`.env.local`](.env.local) to `.env`.

### Start

```
npm run dev
```

## Contributing

Code style? Commit convention? Please check our [Contributing guidelines](CONTRIBUTING.md).

TL;DR: we use [Prettier](https://prettier.io/) and [ESLint](https://eslint.org/), we do like great commit messages and clean Git history.

## Tests

```
npm test
```

The tests start the server from the source (`test/`, Node's test runner with `@babel/register`), without network access:

- `server.test.js`: the server boots and answers, with its real controllers.
- `routes.test.js`: what each URL routes to, with the params and query the controllers get (stubbed controllers).

CI also builds the production bundle and checks that `npm start` answers, with production dependencies only (as on Heroku).

## Deployment

To deploy to staging or production, you need to be a core member of the Open Collective team.

We're currently relying on the `heroku/nodejs` buildpack.

### Staging

None

### Production (heroku)

To deploy to staging or production, you need to be a core member of the Open Collective team.

#### Prerequisite

Install the Heroku CLI

`npm install -g heroku`

Login on the Heroku CLI

`heroku login`

Configure production remote

```
git remote add production https://git.heroku.com/contributors-svg.git
```

#### Deploy

```
npm run deploy:production
```

- URL: https://contributors-svg.opencollective.com/

## Troubleshooting

### Inspecting the Redis cache (production)

```
heroku redis:cli --app contributors-svg
```
