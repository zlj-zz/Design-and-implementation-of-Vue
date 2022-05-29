// 定义文本模式，作为一个状态表
const TextMode = {
  DATA: 'DATA',
  RCDATA: 'RCDATA',
  RAWTEXT: 'RAWTEXT',
  CDATA: 'CDATA'
}

// 解析器函数
function parse(str) {
  // 构建上下文对象
  const context = {
    // 模版内容
    source: str,
    mode: TextMode.DATA,
    // 消费指定数量字符的函数
    advanceBy(num) {
      context.source = context.source.slice(num)
    },
    // 消费空白字符的函数
    advanceSpace() {
      const match = /^[\t\r\n\f ]+/.exec(context.source)
      if (match) {
        context.advanceBy(match[0].length)
      }
    }
  }
  // 解析函数，
  // 第一个参数，上下文对象 context
  // 第二个参数，父节点构成的节点栈，初始为空
  const nodes = parseChildren(context, [])

  // 返回跟节点
  return {
    type: 'Root',
    children: nodes
  }
}

function parseChildren(context, ancestors) {
  // 子节点存储数组
  let nodes = []
  // 从上下文中获取当前状态
  const { mode } = context

  // 开启 while 循环，开始解析
  while (!isEnd(context, ancestors)) {
    let node
    // 只有 DATA 和 RCDATA 模式才支持插值节点的解析
    if (mode === TextMode.DATA || mode === TextMode.RCDATA) {
      // 只有 DATA 模式才支持标签节点的解析
      if (mode === TextMode.DATA && context.source[0] == '<') {
        if (context.source[1] === '!') {
          if (source.startsWith('<!--')) {
            // 解析注释
            node = parseComment(context)
          } else if (context.source.startsWith('<![CDATA[')) {
            // 解析 CDATA
            node = parseCDATA(context, ancestors)
          }
        } else if (context.source[1] === '/') {
          //
          console.error('error')
        } else if (/[a-z]/i.test(context.source[1])) {
          // 解析标签
          node = parseElement(context, ancestors)
        }
      } else if (context.source.startsWith('{{')) {
        // 解析插值
        node = parseInterpolation(context)
      }
    }

    // node 不存在，说明处于其他模式，即非 DATA 模式且非 RCDATA 模式
    // 此时一切内容作为文本处理
    if (!node) {
      node = parseText(context)
    }

    // 将节点添加到 nodes 数组中
    nodes.push(node)
  }

  // 当 while 停止后，说明节点解析完毕，返回子节点
  return nodes
}

function isEnd(context, ancestors) {
  // 当模版内容解析完毕后，停止
  if (!context.source) return true

  // 与父级标签栈中所有节点比较
  for (let i = ancestors.length - 1; i >= 0; i--) {
    // 只要存在同名节点，就停止状态机
    // console.log(ancestors[i])
    if (context.source.startsWith(`</${ancestors[i].tag}`)) {
      return true
    }
  }
}

function parseElement(context, ancestors) {
  // 解析开始标签
  const element = parseTag(context)
  if (element.isSelfClosing) return element

  // 切换到正确的文本模式
  if (element.tag === 'textarea' || element.tag === 'title') {
    context.mode = TextMode.RCDATA
  } else if (/style|xmp|iframe|noembed|noframes|noscript/.test(element.tag)) {
    context.mode = TextMode.RAWTEXT
  } else {
    context.mode = TextMode.DATA
  }

  ancestors.push(element)
  element.children = parseChildren(context, ancestors)
  ancestors.pop()

  if (context.source.startsWith(`</${element.tag}`)) {
    // 再次解析结束标签
    parseTag(context, 'end')
  } else {
    console.error(`${element.tag} 标签缺少闭合标签`)
  }

  return element
}

function parseTag(context, type = 'start') {
  const { advanceBy, advanceSpace } = context

  // 处理开始标签和结束标签的正则有所不同
  const match = type === 'start'
    ? /^<([a-z]+[^\t\r\n />]*)/i.exec(context.source)
    : /^<\/[a-z]+[^\t\r\n\f />]*/i.exec(context.source)
  // 第一个捕获组的值就是标签名称
  const tag = match[1]
  // 消费匹配到的所有内容
  advanceBy(match[0].length)
  // 消费空白字符
  advanceSpace()

  // 解析属性与指令
  const props = parseAttributes(context)

  // 剩余内容以 ‘/>’ 开头，说明这是一个自闭合标签
  const isSelfClosing = context.source.startsWith('/>')
  advanceBy(isSelfClosing ? 2 : 1)

  // 返回标签节点
  return {
    type: 'Element',
    tag,
    props,
    children: [],
    isSelfClosing
  }
}

function parseAttributes(context) {
  const { advanceBy, advanceSpace } = context
  const props = []

  while (
    !context.source.startsWith('>') &&
    !context.source.startsWith('/>')
  ) {
    // 匹配属性名
    const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)
    const name = match[0]

    advanceBy(name.length)
    advanceSpace()
    // 消费引号
    advanceBy(1)
    advanceSpace()

    // 属性值
    let value = ''

    // 获取当前模版内容的第一个字符
    const quote = context.source[0]
    // 判断是否是引号
    const isQuote = quote === '"' || quote === "'"

    if (isQuote) {
      // 消费引号
      advanceBy(1)
      // 获取下一个引号的索引
      const endQuoteIndex = context.source.indexOf(quote)
      if (endQuoteIndex > -1) {
        value = context.source.slice(0, endQuoteIndex)
        advanceBy(value.length)
        advanceBy(1)
      } else {
        console.error('缺少引号')
      }
    } else {
      // 属性值没有被引号包裹
      // 匹配下一个空白字符前的所有内容作为属性值
      const match = /^[^\t\r\n\f >]+/.exec(context.source)
      value = match[0]
      advanceBy(value.length)
    }
    advanceSpace()

    // 创建一个属性节点，添加到 props 中
    props.push({
      type: 'Attribute',
      name,
      value
    })
  }

  return props
}

function parseText(context) {
  // 获取内容结尾的索引，默认将整个模版剩余内容作为文本内容
  let endIndex = context.source.length
  // 寻找 < 的位置索引
  const ltIndex = context.source.indexOf('<')
  // 寻找定界符 {{ 的位置所以
  const delimiterIndex = context.source.indexOf('{{')

  // 取较小的一个作为新的索引
  if (ltIndex > -1 && ltIndex < endIndex) {
    endIndex = ltIndex
  }
  // 取较小的一个作为新的索引
  if (delimiterIndex > -1 && delimiterIndex < endIndex) {
    endIndex = delimiterIndex
  }

  // 获取文本内容
  const content = context.source.slice(0, endIndex)
  context.advanceBy(content.length)

  // 返回文本节点
  return {
    type: 'Text',
    content: decodeHtml(content)
  }
}

const namedCharacterReferences = {
  'gt': '>',
  'gt;': '>',
  'lt': '<',
  'lt;': '<',
  'ltcc;': ''
}

const CCR_REPLACEMENTS = {
  0x80: 0x20ac,
  0x82: 0x201a,
  0x83: 0x0192,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02c6,
  0x89: 0x2030,
  0x8a: 0x0160,
  0x8b: 0x2039,
  0x8c: 0x0152,
  0x8e: 0x017d,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02dc,
  0x99: 0x2122,
  0x9a: 0x0161,
  0x9b: 0x203a,
  0x9c: 0x0153,
  0x9e: 0x017e,
  0x9f: 0x0178,
}

// asAttr 代表文本内容是否挡住属性值
function decodeHtml(rawText, asAttr = false) {
  let offset = 0
  const end = rawText.length
  // 解码后的内容
  let decodedText = ''
  // 引用表中实体名称最大长度
  let maxCRNameLength = 0

  function advance(length) {
    offset += length
    rawText = rawText.slice(length)
  }

  while (offset < end) {
    // 匹配开头部分
    const head = /&(?:#x?)?/i.exec(rawText)
    // 匹配失败
    if (!head) {
      const remaining = end - offset
      decodedText += rawText.slice(0, remaining)
      advance(remaining)
      break
    }

    //
    decodedText += rawText.slice(0, head.index)
    //
    advance(head.index)

    if (head[0] === '&') {
      let name = ''
      let value
      //
      if (/[0-9a-z]/i.test(rawText)) {
        if (!maxCRNameLength) {
          maxCRNameLength = Object.keys(namedCharacterReferences).reduce(
            (max, name) => Math.max(max, name.length),
            0
          )
        }
        for (length = maxCRNameLength; !value && length > 0; --length) {
          name = rawText.substr(1, length)
          value = (namedCharacterReferences)[name]
        }
        if (value) {
          //
          const semi = name.endsWith(';')
          //
          if (asAttr && !semi && /[=a-z0-9]/i.test(rawText[name.length + 1] || '')) {
            decodedText += '&' + name
            advance(1 + name.length)
          } else {
            decodedText += value
            advance(1 + name.length)
          }
        } else {
          decodedText += '&' + name
          advance(1 + name.length)
        }
      } else {
        decodedText += '&'
        advance(1)
      }
    } else {
      // 判断十进制还是十六进制
      const hex = head[0] === '&#x'
      // 获取对应的正则
      const pattern = hex ? /^&#x([0-9a-f]+);?/i : /^&#([0-9]+);?/
      // 匹配
      const body = pattern.exec(rawText)

      if (body) {
        let cp = Number.parseInt(body[1], hex ? 16 : 10)
        if (cp === 0) {
          cp = 0xfffd
        } else if (cp > 0x10ffff) {
          // 超过最大 Unicode 值
          cp = 0xfffd
        } else if (cp >= 0xd800 && cp <= 0xdfff) {
          // 位于 surrogate pair 范围内
          cp = 0xfffd
        } else if ((cp >= 0xfdd0 && cp <= 0xfdef) || ((cp & 0xfffe) === 0xfffe)) {
          // 位于 noncharacter 范围
          //noop
        } else if (
          // 控制字符集的范围
          (cp >= 0x01 && cp <= 0x08) ||
          cp === 0x0b ||
          (cp >= 0x0d && cp <= 0x1f) ||
          (cp >= 0x7f && cp <= 0x9f)
        ) {
          // 寻找替换，找不到使用原码
          cp = CCR_REPLACEMENTS[cp] || cp
        }

        // 解码后追加
        decodedText += String.fromCodePoint(cp)
        advance(body[0].length)
      } else {
        // 匹配失败，则不尽兴解码操作
        decodedText += head[0]
        advance(head[0].length)
      }
    }
  }

  // console.log('decodedText', decodedText)
  return decodedText
}

function parseInterpolation(context) {
  // 消费定界符
  context.advanceBy('{{'.length)
  //
  const closeIndex = context.source.indexOf('}}')
  if (closeIndex < 0) {
    console.error('插值缺少结束定界符')
  }

  //
  const content = context.source.slice(0, closeIndex)
  context.advanceBy(content.length)
  context.advanceBy('}}'.length)

  return {
    type: 'Interpolation',
    context: {
      type: 'Expression',
      content: decodeHtml(content)
    }
  }
}

function parseComment(context) {
  // 消费开始部分
  context.advanceBy('<!--'.length)
  // 找到注释结束的索引
  closeIndex = context.source.indexOf('-->')
  // 截取注释内容
  const content = context.source.slice(0, closeIndex)
  // 消费就结束部分
  context.advanceBy('-->'.length)
  // 返回节点
  return {
    type: 'Comment',
    content
  }
}





/** test */
const template = `<div id="foo" v-show="display" @click='handler'>a&ltb, &#36; {{bar}} </div>`
let res = parse(template)
console.log(res)
