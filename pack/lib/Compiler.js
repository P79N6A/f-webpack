const fs = require("fs")
const path = require('path')

// babylon 源码=> ast
// @babel/traverse @babel/types @babel/generator
const babylon = require('babylon')
const t = require('@babel/types')
const traverse = require('@babel/traverse').default
const generator = require('@babel/generator').default

const ejs = require('ejs')
const {SyncHook} = require('tapable')

class Compiler {
  constructor(config) {
    this.config = config
    //需要保存入口文件路径
    this.entryId;
    //需要保存所有模块依赖
    this.modules = {}
    this.entry = config.entry; //入口路径
    //工作路径
    this.root = process.cwd()

    //webpack钩子
    this.hooks = {
      entryOption: new SyncHook(), //入口钩子
      afterPlugins: new SyncHook(),
      compile: new SyncHook(), //编译钩子
      afterCompile: new SyncHook(),
      run: new SyncHook(),
      emit: new SyncHook(),
      done: new SyncHook()
    };

    // 如果传递了plugins参数
    let plugins = this.config.plugins;
    if (Array.isArray(plugins)) {
      plugins.forEach(plugin => {
        plugin.apply(this); //在回调里面让plugins方法挂载到对应hook
      });
    }
    this.hooks.afterPlugins.call();
  }
  getSource(modulePath) {
    let rules = this.config.module.rules
    let content = fs.readFileSync(modulePath, 'utf8')
    //拿到每个规则
    for (let i = 0; i < rules.length; i++) {
      let rule = rules[i]
      let {
        test,
        use
      } = rule
      if (test.test(modulePath)) {
        //该模块需要loader转换
        //遍历调用Loader
        let loader;
        for (let j = use.length - 1; j >= 0; j--) {
          //逆序使用loader
          loader = require(use[j]);
          content = loader(content);
        }
      }
    }

    return content
  }
  //解析源码
  parse(source, parentPath) {
    //AST 解析语法树
    let ast = babylon.parse(source)
    //依赖数组
    let dependencies = []
    traverse(ast, {
      CallExpression(p) {
        let node = p.node //对应的节点
        if (node.callee.name === 'require') {
          node.callee.name = '__webpack_require__'
          //取到模块的引用名字
          let moduleName = node.arguments[0].value
          moduleName = moduleName + (path.extname(moduleName) ? '' : '.js') //补全后缀
          moduleName = "./" + path.join(parentPath, moduleName) // 例如 './a.js'
          dependencies.push(moduleName)
          node.arguments = [t.StringLiteral(moduleName)]
        }
      }
    })
    let sourceCode = generator(ast).code
    return {
      sourceCode,
      dependencies
    }
  }
  buildModule(modulePath, isEntry = false) {
    //拿到模块内容
    let source = this.getSource(modulePath)
    //模块id 相对路径 = modulePath - this.root
    let moduleName = './' + path.relative(this.root, modulePath)
    if (isEntry) {
      //保存入口名
      this.entryId = moduleName
    }

    //解析把source源码进行改造 返回一个依赖列表
    let {
      sourceCode,
      dependencies
    } = this.parse(source, path.dirname(moduleName))
    // 递归父模块的依赖
    dependencies.forEach((dep) => {
      this.buildModule(path.join(this.root, dep))
    })
    //把相对路径和模块内容对应起来
    this.modules[moduleName] = sourceCode
  }
  emitFile() {
    //用数据+模板渲染出文件
    let main = path.join(this.config.output.path, this.config.output.filename); //输出路径
    let templateStr = this.getSource(path.join(__dirname, 'main.ejs')); //模板路径
    //模板+数据=代码
    let code = ejs.render(templateStr, {
      entryId: this.entryId,
      modules: this.modules
    });
    this.assets = {};
    // 资源中 路径对应的代码
    this.assets[main] = code;
    fs.writeFileSync(main, this.assets[main]);
  }
  run() {
    // run plugin钩子
    this.hooks.run.call();
    //执行 创建模块的依赖关系
    this.buildModule(path.resolve(this.root, this.entry), true)
    //生成一个文件=>打包后的文件
    this.emitFile()
    // 打包后plugin钩子
    this.hooks.emit.call();
  }
}
module.exports = Compiler;