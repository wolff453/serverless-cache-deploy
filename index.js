'use strict'

const fs = require('fs-extra')
const crypto = require('crypto')
const { LambdaClient, UpdateFunctionCodeCommand, UpdateFunctionConfigurationCommand } = require('@aws-sdk/client-lambda')
const { join } = require('path')

class MyPlugin {
  constructor(serverless) {
    this.serverless = serverless
    this.client = new LambdaClient({ region: this.serverless.configurationInput.provider.region })
    this.hooks = {
      'package:finalize': () => this.cache()
    }
  }

  async deploy(configuration, stream) {
    return Promise.all(Object.keys(configuration.functions).map(async (key) => {
      console.log(`${configuration.service}-${key}`)
      await this.client.send(new UpdateFunctionCodeCommand({
        FunctionName: `${configuration.service}-${configuration.provider.stage}-${key}`,
        ZipFile: stream
      }))
    }))
  }

  async getZipStream(config) {
    return fs.promises.readFile(`${process.cwd()}/.serverless/${config.service}.zip`)
  }

  async validateCache(hash, relativeUrl) {
    try {
      const dir = await fs.promises.readdir(join(process.cwd(), relativeUrl))
      return dir.some(files => files.includes(hash))
    } catch (error) {
      return false
    }
  }

  getConfiguration() {
    return this.serverless.configurationInput
  }

  generateHash(config) {
    return crypto.createHash('md5').update(config).digest('hex')
  }

  async createFileCache(filename, relativeUrl) {
    return fs.outputFile(`${join(process.cwd(), relativeUrl)}/${filename}`, filename)
  }

  clearHooks() {
    Object.entries(this.serverless.pluginManager.hooks).forEach(([key, value]) => {
      if (key === 'finalize') {
        return
      }
      value.forEach(item => {
        item.hook = () => Promise.resolve()
      })
    })
  }

  removeVersionLogicalId(config) {
    Object.values(config.functions).forEach((value) => {
      delete value.versionLogicalId
    })
  }

  removeArtifactDirectoryName(config) {
    delete config.package.artifactDirectoryName
  }

  removeCompiledCloudFormationTemplate(config) {
    delete config.provider.compiledCloudFormationTemplate
  }

  deleteDynamicObjects() {
    const copyConfig = JSON.parse(JSON.stringify(this.getConfiguration()))
    this.removeVersionLogicalId(copyConfig)
    this.removeArtifactDirectoryName(copyConfig)
    this.removeCompiledCloudFormationTemplate(copyConfig)
    return JSON.stringify(copyConfig)
  }

  async updateFunctionsConfiguration(layer) {
    const functions = this.getFunctions()
    await Promise.all(Object.entries(functions).map(async functionName => {
      await this.client.send(new UpdateFunctionConfigurationCommand({
        FunctionName: `${this.serverless.configurationInput.service}-${functionName}`,
        Layers: [layer.LayerArn]
      }))
    }))
  }

  getRelativeDir() {
    return this.serverless.configurationInput.custom?.cache?.relativeUrl
  }

  async cache() {
    try {
      const config = this.getConfiguration()
      const relativeUrl = this.getRelativeDir()
      const obj = this.deleteDynamicObjects()
      const hash = this.generateHash(obj)
      const cache = await this.validateCache(hash, relativeUrl)
      console.log('Generated hash:', hash)
      if (cache) {
        const stream = await this.getZipStream(config)
        console.log('Starting deploy')
        await this.deploy(config, stream)
        console.log('Deploy done')
        this.clearHooks()
        console.log('Cache created')
        return
      }
      await this.createFileCache(hash, relativeUrl)
      console.log('Cache file created with success')
    } catch (error) {
      console.log(error)
    }
  }
}

module.exports = MyPlugin
