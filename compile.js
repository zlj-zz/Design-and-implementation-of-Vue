// 定义状态机的状态
const State = {
  initial: 1,    // 初始状态
  tagOpen: 2,    // 标签开始状态
  tagName: 3,    // 标签名称状态
  text: 4,       // 文本状态
  tagEnd: 5,     // 结束标签状态
  tagEndName: 6, // 结束标签名称状态
}

function isAlpha(char) {
  return char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z'
}

// 接收字符串，并将模版切分为 token 返回
function tokenize(str) {
  // 初始化状态
  let currentState = State.initial
  // 存储字符
  const chars = []
  // 存储生成的 token
  const tokens = []

  // 启动自动机
  while (str) {
    // 查看第一个字符
    const char = str[0]
    // 匹配当前状态
    switch (currentState) {
      // 当前状态机为初始状态时
      case State.initial:
        if (char === '<') {
          // 1. 遇到 <，状态机切换到标签开始状态
          currentState = State.tagOpen
          // 消费字符
          str = str.slice(1)
        } else if (isAlpha(char)) {
          // 1. 遇到字母，状态机切换到文本状态
          currentState = State.text
          // 2. 当前字符缓存到 chars 中
          chars.push(char)

          str = str.slice(1)
        }
        break
      // 当前状态机为标签开始状态时
      case State.tagOpen:
        if (isAlpha(char)) {
          // 1. 遇到字母，切换到标签名称状态
          currentState = State.tagName
          // 2. 缓存字符
          chars.push(char)

          str = str.slice(1)
        } else if (char === '/') {
          // 1. 遇到 /，切换到结束标签状态
          currentState = State.tagEnd

          str = str.slice(1)
        }
        break
      // 当前状态机为标签名称状态时
      case State.tagName:
        if (isAlpha(char)) {
          // 1. 遇到字母，缓存字符
          chars.push(char)

          str = str.slice(1)
        } else if (char === '>') {
          // 1. 遇到 >，切换到初始状态
          currentState = State.initial
          // 2. 生成 taken，并添加到 tokens 中
          tokens.push({
            type: 'tag',
            name: chars.join('')
          })
          // 3. chars 中字符已被消费，清空 chars
          chars.length = 0

          str = str.slice(1)
        }
        break
      // 当前状态机为文本状态时
      case State.text:
        if (isAlpha(char)) {
          // 1. 遇到字母，缓存字符，保持状态不变
          chars.push(char)
          str = str.slice(1)
        } else if (char === '<') {
          // 1. 遇到 <，切换到标签开始状态
          currentState = State.tagOpen
          // 2. 生成 token
          tokens.push({
            type: 'text',
            content: chars.join('')
          })
          // 3. 清空 chars
          chars.length = 0

          str = str.slice(1)
        }
        break
      // 当前状态机为标签结束状态时
      case State.tagEnd:
        if (isAlpha(char)) {
          currentState = State.tagEndName
          chars.push(char)

          str = str.slice(1)
        }
        break
      // 当前状态机为结束标签名称状态时
      case State.tagEndName:
        if (isAlpha(char)) {
          chars.push(char)

          str = str.slice(1)
        } else if (char === '>') {
          currentState = State.initial

          tokens.push({
            type: 'tagEnd',
            name: chars.join('')
          })
          chars.length = 0

          str = str.slice(1)
        }
        break
    }
  }

  return tokens
}

function parse(str) {
  // 对模版进行标记化，得到 tokens
  const tokens = tokenize(str)
  // 创建 root 根节点
  const root = {
    type: 'Root',
    children: []
  }
  // 创建栈，初始只有 root 节点
  const elementStack = [root]

  // 使用 while 扫描 tokens，直到所有 token 都被扫描完为止
  while (tokens.length) {
    // 获取栈顶节点作为父节点 parent
    const parent = elementStack[elementStack.length - 1]
    // 当前的 token
    const t = tokens[0]
    switch (t.type) {
      // 如果当前 Token 是开始标签，创建 ELement 类型的 AST 节点
      case 'tag':
        const elementNode = {
          type: 'Element',
          tag: t.name,
          children: []
        }
        // 添加到当前父节点的 children 中
        parent.children.push(elementNode)
        // 当前节点压入栈
        elementStack.push(elementNode)
        break
      // 如果当前 Token 是文本，创建 Text 类型的 AST 节点
      case 'text':
        const textNode = {
          type: 'Text',
          content: t.content
        }
        parent.children.push(textNode)
        break
      case 'tagEnd':
        // 遇到结束标签，将栈顶节点弹出
        elementStack.pop()
        break
    }
    // 消费已经扫描过的 token
    tokens.shift()
  }
  // 最后返回 AST
  return root
}

function dump(node, indent = 0) {
  // 当前节点的类型
  const type = node.type

  const desc = node.type === 'Root'
    ? ''
    : node.type === 'Element'
      ? node.tag
      : node.content

  // 打印节点类型和描述信息
  console.log(`${'-'.repeat(indent)}${type}: ${desc}`)

  // 递归打印子节点
  if (node.children) {
    node.children.forEach(n => dump(n, indent + 2))
  }
}

function traverseNode(ast, context) {
  // 当前节点， ast 本身就是 Root 节点
  context.currentNode = ast

  // 增加推退出阶段的回调函数数组
  const exitFns = []

  // context.nodeTransforms 是一个数组，其中每一个元素都是一个函数
  const transforms = context.nodeTransforms
  for (let i = 0; i < transforms.length; i++) {
    // 将当前节点和 context 都传递给 nodeTransforms 中注册的回调函数
    const onExit = transforms[i](context.currentNode, context)
    if (onExit) {
      // 将退出回调添加到 exitFns 中
      exitFns.push(onExit)
    }
    // 由于任何函数都有可能移除当前节点，所以每个函数执行完后要检查当前节点是否被移除
    // 若被移除，直接返回即可
    if (!context.currentNode) return
  }

  // 如果有子节点，递归惊醒遍历
  const children = context.currentNode.children
  if (children) {
    for (let i = 0; i < children.length; i++) {
      // 转换子节点前，设置当前节点为父节点
      context.parent = context.currentNode
      // 设置位置索引
      context.childIndex = i

      traverseNode(children[i], context)
    }
  }

  // 在节点处理的最后阶段执行 exitFns 中的回调函数
  // 注意，这里要反序执行
  let i = exitFns.length
  while (i--) {
    exitFns[i]()
  }
}

// 封装函数，用来对 ast 进行转换
function transform(ast) {

  const context = {
    // 存储当前正在转换的节点
    currentNode: null,
    // 存储当前节点在父节点的位置索引
    childIndex: 0,
    // 存储当前节点的父节点
    parent: null,
    // 用于替换节点的函数，接收新节点作为参数
    replaceNode(node) {
      // 找到当前节点在父节点中的位置，进行替换
      context.parent.children[context.childIndex] = node
      // 替换当前节点
      context.currentNode = node
    },
    //
    removeNode() {
      if (context.parent) {
        // 调用数组 splice 方法，移除当前节点
        context.parent.children.splice(context.childIndex, 1)
        // 设置当前节点为空
        context.currentNode = null
      }
    },
    nodeTransforms: [
      transformElement,
      transformText,
      transformRoot
    ]
  }

  // 调用 traverseNode 完成转换
  traverseNode(ast, context)
  // 打印节点信息
  dump(ast)
}

// 创建字符串节点
function createStringLiteral(value) {
  return {
    type: 'StringLiteral',
    value
  }
}

// 创建变量节点
function createIdentifier(name) {
  return {
    type: 'Identifier',
    name
  }
}

// 创建数组节点
function createArrayExpression(elements) {
  return {
    type: 'ArrayExpression',
    elements
  }
}

// 创建可调用节点
function createCallExpression(callee, arguments) {
  return {
    type: 'CallExpression',
    callee: createIdentifier(callee),
    arguments
  }
}

// 转换文本节点
function transformText(node) {
  if (node.type !== 'Text') {
    return
  }
  // 创建的 JavaScript AST 节点添加到 node.jsNode 属性下
  node.jsNode = createStringLiteral(node.content)
}

// 转换标签节点
function transformElement(node) {
  // 将转换代码卸载退出阶段回调中，
  // 可以确保该标签的子节点全部被处理完毕
  return () => {
    if (node.type !== 'Element') {
      return
    }

    // 1. 创建 h 函数调用语句
    const callExp = createCallExpression('h', [
      createStringLiteral(node.tag)
    ])
    // 2. 处理 h 函数的调用参数
    node.children.length === 1
      ? callExp.arguments.push(node.children[0].jsNode)
      : callExp.arguments.push(
        createArrayExpression(node.children.map(c => c.jsNode))
      )
    // 3. 设置对应的 jsNode 属性
    node.jsNode = callExp
  }
}

// 转换 Root 节点
function transformRoot(node) {
  return () => {
    if (node.type !== 'Root') {
      return
    }

    // node 是根节点，跟节点的第一个子节点就是模版的跟节点
    // 暂不考虑多个根节点的情况
    const vnodeJSAST = node.children[0].jsNode
    // 创建 render 函数的声名语句节点
    node.jsNode = {
      type: 'FunctionDecl',
      id: { type: 'Identifier', name: 'render' },
      params: [],
      body: [
        {
          type: 'ReturnStatement',
          return: vnodeJSAST
        }
      ]
    }

  }
}

function generate(node) {

  const context = {
    // 存储最终代码
    code: '',
    // 完成代码拼接
    push(code) {
      context.code += code
    },
    // 当前缩进，初始为 0
    currentIndent: 0,
    // 换行并保留缩进
    newline() {
      context.code += '\n' + ' '.repeat(context.currentIndent)
    },
    // 缩进
    indent() {
      context.currentIndent++
      context.newline()
    },
    // 取消缩进
    deIndent() {
      context.currentIndent--
      context.newline()
    }
  }

  // 调用 genNode 完成代码生成
  genNode(node, context)

  // 返回渲染函数代码
  return context.code
}

function genNode(node, context) {
  switch (node.type) {
    case 'FunctionDecl':
      genFunctionDecl(node, context)
      break
    case 'ReturnStatement':
      genReturnStatement(node, context)
      break
    case 'CallExpression':
      genCallExpression(node, context)
      break
    case 'StringLiteral':
      genStringLiteral(node, context)
      break
    case 'ArrayExpression':
      genArrayExpression(node, context)
      break
  }
}

function genNodeList(nodes, context) {
  const { push } = context
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    genNode(node, context)
    if (i < nodes.length - 1) {
      push(', ')
    }
  }
}

function genFunctionDecl(node, context) {
  // 取出工具方法
  const { push, indent, deIndent } = context
  // 函数名称
  push(`function ${node.id.name}`)
  push('(')
  // 生成参数代码
  genNodeList(node.params, context)
  push(') ')
  push('{')
  // 缩进
  indent()
  // 生成函数体，递归方式
  node.body.forEach(n => genNode(n, context))
  // 取消缩进
  deIndent()
  push('}')
}

function genArrayExpression(node, context) {
  const { push } = context
  // 追加方括号
  push('[')
  genNodeList(node.elements, context)
  // 补齐方括号
  push(']')
}

function genReturnStatement(node, context) {
  const { push } = context
  push('return ')
  genNode(node.return, context)
}

function genStringLiteral(node, context) {
  const { push } = context
  push(`'${node.value}'`)
}

function genCallExpression(node, context) {
  const { push } = context
  const { callee, arguments: args } = node
  push(`${callee.name}(`)
  genNodeList(args, context)
  push(')')
}


function compile(template) {
  // 模版 AST
  const ast = parse(template)
  // 将模版 AST 转换成 JavaScript AST
  transform(ast)
  // 代码生成
  // console.log(ast)
  // console.log(ast.jsNode)
  const code = generate(ast.jsNode)

  return code
}








/** test */
console.log(tokenize('<p>Vue</p>'))

const template = '<div><p>Vue</p><p>Template</p></div>'
// const ast = parse(template)
// transform(ast)

let code = compile(template)
console.log(code)
