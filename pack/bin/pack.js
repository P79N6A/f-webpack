#! /usr/bin/env node

//1. 找到当前执行文件的路径，找到webpack.config.js
const path = require('path')
const config = require(path.resolve('webpack.config.js'))

const Compiler = require("../lib/Compiler.js")
const compiler = new Compiler(config)

compiler.run()

