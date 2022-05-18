const Text = Symbol() // 文本节点的 type 标识
const Comment = Symbol() // 注释节点的 type 标识
const Fragment = Symbol()

function createRenderer(options) {
  const {
    createElement,
    setElementText,
    insert,
    createText,
    setText,
    createComment,
    patchProps,
  } = options
  // 在这个作用域定义的函数都可以访问

  function mountElement(vnode, container, anchor) {
    // 调用 createElement 函数创建元素
    // 让 vnode.el 引用真实 DOM 元素
    const el = vnode.el = createElement(vnode.type)

    if (typeof vnode.children === 'string') {
      // 调用 setElementText 函数设置元素的文本节点
      setElementText(el, vnode.children)
    } else if (Array.isArray(vnode.children)) {
      // 如果 children 是数组，遍历每一个字节点，并调用 patch 函数挂载它们
      vnode.children.forEach(child => {
        patch(null, child, el)
      })
    }

    // 如果 vnode.props 存在才处理
    if (vnode.props) {
      // 遍历 props
      for (const key in vnode.props) {
        patchProps(el, key, null, vnode.props[key])
      }
    }
    // 调用 insert 函数将元素插入到容器中
    insert(el, container, anchor)
  }

  function patchElement(n1, n2) {
    const el = n2.el = n1.el
    const oldProps = n1.props
    const newProps = n2.props
    // 第一步，更新 props
    for (const key in newProps) {
      if (newProps[key] !== oldProps[key]) {
        patchProps(el, key, oldProps[key], newProps[key])
      }
    }
    for (const key in oldProps) {
      if (!(key in newProps)) {
        patchProps(el, key, oldProps[key], null)
      }
    }
    // 第二部，更新 children
    patchChildren(n1, n2, el)
  }

  /** 快速 diff 算法 */
  function patchKeyedChildren(n1, n2, container) {
    const oldChildren = n1.children
    const newChildren = n2.children

    // 索引 j 指向新旧两组子节点的开头
    let j = 0
    let oldVNode = oldChildren[j]
    let newVNode = newChildren[j]

    // 从头正向遍历，直到有不同 key 的节点为止
    while (oldVNode.key == newVNode.key) {
      // 进行更新
      patch(oldVNode, newVNode, container)

      // 更新索引
      j++
      oldVNode = oldChildren[j]
      newVNode = newChildren[j]
    }

    // 索引分别指向新旧子节点的最后一个节点
    let oldEnd = oldChildren.length - 1
    let newEnd = newChildren.length - 1

    oldVNode = oldChildren[oldEnd]
    newVNode = newChildren[newEnd]

    // 从尾逆遍历，直到有不同 key 的节点为止
    while (oldVNode.key == newVNode.key) {
      // 进行更新
      patch(oldVNode, newVNode, container)

      // 更新索引
      oldEnd--
      newEnd--
      oldVNode = oldChildren[oldEnd]
      newVNode = newChildren[newEnd]
    }

    // 有剩余节点的处理
    if (j > oldEnd && j <= newEnd) {
      // 只剩余了新节点，表明都需要插入

      // 获取锚点索引
      const anchorIndex = newEnd + 1
      // 获取锚点
      // 如果锚点索引大于节点集长度，说明对应节点已经是尾部节点，无需提供锚点
      const anchor = anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null
      while (j <= newEnd) {
        patch(null, newChildren[j++], container, anchor)
      }
    } else if (j > newEnd && j <= oldEnd) {
      // 只剩余旧节点，表明都需要卸载

      while (j <= oldEnd) {
        unmount(oldChildren[j++])
      }
    } else {
      // 构造 source 数组
      // 新的子节点中剩余未处理的节点数量
      const count = newEnd - j + 1
      const sources = new Array(count)
      sources.fill(-1)

      // 分别指向新旧起始索引，即 j
      const oldStart = j
      const newStart = j
      // 是否需要移动节点
      let moved = false
      let pos = 0
      // 构建索引表
      const keyIndex = {}
      for (let i = newStart; i <= newEnd; i++) {
        keyIndex[newChildren[i].key] = i
      }

      // 表示更新过的节点数量
      let patched = 0
      // 遍历剩余旧子节点中未处理的
      for (let i = oldStart; i < oldEnd; i++) {
        oldVNode = oldChildren[i]
        if (patched <= count) {
          // 通过索引表查找是否有相同 key 的新子节点和它的位置
          const k = keyIndex[oldVNode.key]

          if (typeof k !== 'undefined') {
            newVNode = newChildren[k]
            patch(oldVNode, newVNode, container)
            // 增加计数
            patched++
            // 填充 source 数组
            sources[k - newStart] = i
            if (k < pos) {
              moved = true
            } else {
              pos = k
            }
          } else {
            // 没找到，卸载
            unmount(oldVNode)
          }
        } else {
          // 更新过的节点数量大于剩余新节点的数量，表明剩下都是多余的
          unmount(oldVNode)
        }
      }

      if (moved) {
        // 计算最大子序列
        const seq = getSequence(sources)

        //
        let s = seq.length - 1
        //
        let i = count - 1
        for (i; i >= 0; i--) {
          if (sources[i] === -1) {
            // 全新节点，需要被挂载

            // 该节点在新 children 中的真实索引
            const pos = i + newStart
            // 获取新节点
            const newVNode = newChildren[pos]
            // 获取锚点索引
            const nextPos = pos + 1
            // 获取锚点
            const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null
            // 挂载新节点
            patch(null, newVNode, container, anchor)
          } else if (i !== seq[s]) {
            // 说明需要移动

            const pos = i + newStart
            const newVNode = newChildren[pos]
            const nextPos = pos + 1
            const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null
            // 移动节点
            insert(newVNode.el, container, anchor)
          } else {
            // 当两者相等时，满足子序列，说明该节点不需要移动
            // 只需要让 s 指向下一个位置
            s--
          }
        }
      }
    }

  }

  function patchChildren(n1, n2, container) {
    // 判断新字节点是否为文本
    if (typeof n2.children === 'string') {
      // 旧字节点有三种可能： 没有、文本、一组字节点
      // 只有旧字节点为一组字节点，需要逐个卸载，其他情况什么都不用做
      if (Array.isArray(n1.children)) {
        n1.children.forEach((c) => unmount(c))
      }
      setElementText(container, n2.children)
    } else if (Array.isArray(n2.children)) {
      // 封装 diff 算法
      patchKeyedChildren(n1, n2, container)
    } else {
      // 运行到这，说明新字节点不存在
      if (Array.isArray(n1.children)) {
        // 若旧字节点是一组字节点，逐个卸载
        n1.children.forEach((c) => unmount(c))
      } else if (typeof n1.children === 'string') {
        // 若旧字节点是文本，清空文本内容
        setElementText(container, '')
      }
    }
    // 如果也没有旧字节点，则什么都不需要做
  }

  function patch(n1, n2, container, anchor) {
    if (n1 && n1.type !== n2.type) {
      unmount(n1)
      n1 = null
    }
    // 运行到这，证明 n1 和 n2 所描述的内容相同
    const { type } = n2
    // 如果 n2.type 的值是字符串类型，则它描述的是普通标签元素
    if (typeof type === 'string') {
      if (!n1) {
        mountElement(n1, n2, container, anchor)
      } else {
        // 更新
        patchElement(n1, n2)
      }
    } else if (typeof type === 'object') {
      //如果 n2.type 的值是类型对象，则它描述的是组件
    } else if (type === Text) {
      if (!n1) {
        // 调用 createText 创建文本节点
        const el = n2.el = createText(n2.children)
        insert(el, container)
      } else {
        const el = n2.el = n1.el
        if (n2.children !== n1.children) {
          // 设置新的内容
          setText(el, n2.children)
        }
      }
    } else if (type === Comment) {
      // 类似 Text 处理
    } else if (type === Fragment) {
      if (!n1) {
        // 如果旧 vnode 不存在，只需遍历 Fragment 的 children 挂载即可
        n2.children.forEach(c => patch(null, c, container))
      } else {
        // 如果旧 vnode 存在， 则只需更新 Fragment 的 children 即可
        patchChildren(n1, n2, container)
      }
    }
  }

  function unmount(vnode) {
    // 卸载时，如果类型为 Fragment，则只需卸载 Fragment 的 children
    if (vnode.type === Fragment) {
      vnode.children.forEach(c => unmount(c))
      return
    }

    const parent = vnode.el.parentNode
    if (parent) {
      parent.removeChild(vnode.el)
    }

  }

  function render(vnode, container) {
    if (vnode) {
      // 新 vnode 存在，将新旧一起传给 patch 函数，进行打补丁
      patch(container._vnode, vnode, container)
    } else {
      if (container._vnode) {
        // 旧 vnode 存在，且新 vnode 不存在，说明是卸载操作
        unmount(container._vnode)
      }
    }
    // 把 vnode 存储到 container._vnode 下，即后续渲染中的旧 vnode
    container._vnode = vnode
  }

  return {
    render
  }
}

function shouldSetAsProps(el, key, value) {
  // 特殊处理
  if (key === 'form' && el.tagName == 'INPUT') return false
  // 兜底
  return key in el
}

const renderer = createRenderer({
  // 创建元素
  createElement(tag) {
    return document.createElement(tag)
  },
  // 设置元素文本节点
  setElementText(el, text) {
    el.textContent = text
  },
  // 在给定的 parent 下添加指定元素
  insert(el, parent, anchor = null) {
    parent.insertBefore(el, anchor)
  },
  createText(text) {
    return document.createTextNode(text)
  },
  setText(el, text) {
    el.nodeValue = text
  },
  createComment(text) {
    return document.createComment(text)
  },
  patchProps(el, key, preValue, nextValue) {
    // 匹配 on 开头的属性，视为事件
    if (/^on/.test(key)) {
      // 定义 el._evi 为一个对象，存储事件名到事件函数的映射
      let invokers = el._vei || (el._vei = {})
      // 根据事件名获取 invoker
      let invoker = invokers[key]
      // 根据属性名获取到事件名，如 onClick --> click
      const name = key.slice(2).toLowerCase()
      if (nextValue) {
        if (!invoker) {
          // 如果没有 invoker，则将一个伪造的 invoker 缓存到 el._evi 中
          // vei 是 vue event invoker 的首字母缩写
          invoker = el._vei[key] = (e) => {
            // e.timeStamp 是事件发生的时间
            // 如果时间发生的时间早于事件绑定的事件，则不执行事件
            if (e.timeStamp < invoker.attached) return
            if (Array.isArray(invoker.value)) {
              // 如果 invoker.value 是数组，遍历调用
              invoker.value.forEach(fn => fn(e))
            } else {
              // 当伪造的事件处理函数执行时，会执行真正的事件处理函数
              invoker.value(e)
            }
          }
          // 将真正的事件处理函数给 invoker.value
          invoker.value = nextValue
          // 存储事件绑定的时间
          invoker.attached = performance.now()
          // 绑定事件处理
          el.addEventListener(name, invoker)
        } else {
          invoker.value = nextValue
        }
      } else if (invoker) {
        // 新的事件不存在，旧的 invoker 存在，则移除事件
        el.removeEventListener(name, invoker)
      }
    } else if (key === 'class') {
      // 对 class 进行特殊处理
      el.className = nextValue || ''
    } else if (shouldSetAsProps(el, key, nextValue)) {
      // 判断 key 是否存在对应的 DOM Properties
      // 获取 DOM Properties 的类型
      const type = typeof el[key]
      // 如果是布尔类型，并且 value 是空字符串，则将值矫正成 true
      if (type === 'boolean' && nextValue === '') {
        el[key] = true
      } else {
        el[key] = nextValue
      }
    } else {
      // 如果要设置的属性没有对应的 DOM Properties，则使用 setAttribute 函数设置
      el.setAttribute(key, nextValue)
    }
  }
})

const vnode = {
  type: 'div',
  props: {
    class: 'ddd'
  },
  children: [
    {
      type: 'p',
      props: {
        onClick: () => {
          console.log('abc')
        }
      },
      children: 'text`SS'
    }
  ]
}
