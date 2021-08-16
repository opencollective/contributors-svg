# Contributors SVG

[![Dependency Status](https://david-dm.org/opencollective/contributors-svg/status.svg)](https://david-dm.org/opencollective/contributors-svg)

## Foreword

If you see a step below that could be improved (or is outdated), please update the instructions. We rarely go through this process ourselves, so your fresh pair of eyes and your recent experience with it, makes you the best candidate to improve them for other users. Thank you!

## Development

### Prerequisite

1. Make sure you have Node.js version >= 14. We recommend using version 14, the one used in CI and production.

- We recommend using [nvm](https://github.com/creationix/nvm): `nvm install && nvm use`.

2. Make sure you have [GraphicsMagick](http://www.graphicsmagick.org) installed.

- On Debian/Ubuntu: `sudo apt-get install graphicsmagick`
- On MacOS (with [Homebrew](https://brew.sh/)): `brew install graphicsmagick`

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

None

## Deployment

To deploy to staging or production, you need to be a core member of the Open Collective team.

We're currently relying on the following Heroku buildpacks:

- https://github.com/heroku/heroku-buildpack-apt
- https://github.com/MikeKoval/heroku-buildpack-graphicsmagick
- heroku/nodejs

### Staging

None

### Production (heroku)

```
# Before first deployment, configure production remote
git remote add production https://git.heroku.com/contributors-svg.git

# Then deploy main with
npm run deploy:production
```

- URL: https://contributors-svg.opencollective.com/
