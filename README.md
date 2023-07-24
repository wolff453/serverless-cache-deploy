# serverless-cache-deploy

## This plugin cache the serverless.yml file and not create the cloudformation stack if dont have changes.

![imagem](docs/diagram.jpeg)

## Installation

### First install the plugin via npm.

```sh
npm install serverless-cache-deploy --save-dev
```
Then include the plugin within your serverless.yml config.
```yml
plugins:
  - serverless-plugin-include-dependencies
```

## Usage Example
custom.yml
```yml
cache:
  relativeUrl: ../exampleRelativeUrlToYourDir
```