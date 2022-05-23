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

/** test */
console.log(tokenize('<p>Vue</p>'))

const ast = parse('<div><p>Vue</p><p>Template</p></div>')
console.log(ast)
dump(ast)
