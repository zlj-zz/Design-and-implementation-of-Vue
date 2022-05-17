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

  function patchKeyedChildren(n1, n2, container) {
    const oldChildren = n1.children
    const newChildren = n2.children
    // 4 个索引值
    let oldStartIdx = 0
    let oldEndIdx = oldChildren.length - 1
    let newStartIdx = 0
    let newEndIdx = newChildren.length - 1
    // 4 个索引值指向的 vnode
    let oldStartVNode = oldChildren[oldStartIdx]
    let oldEndVNode = oldChildren[oldEndIdx]
    let newStartVNode = newChildren[newStartIdx]
    let newEndVNode = newChildren[newEndIdx]

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      if (!oldStartVNode) {
        oldStartVNode = oldChildren[++oldStartIdx]
      } else if (!oldEndVNode) {
        oldEndVNode = oldChildren[--oldEndIdx]
      } else if (oldStartVNode.key === newStartVNode.key) {
        patch(oldStartVNode, newStartVNode, container)

        oldStartVNode = oldChildren[++oldStartIdx]
        newStartVNode = newChildren[++newStartIdx]
      } else if (oldEndVNode.key === newEndVNode.key) {
        patch(oldEndVNode, newEndVNode, container)

        oldEndVNode = oldChildren[--oldEndIdx]
        newEndVNode = newChildren[--newEndIdx]
      } else if (oldStartVNode.key === newEndVNode.key) {
        patch(oldStartVNode, newEndVNode, container)
        insert(oldEndVNode.el, container, oldStartVNode.el)

        oldStartVNode = oldChildren[++oldStartIdx]
        newEndVNode = newChildren[--newEndIdx]
      } else if (oldEndVNode.key === newStartVNode.key) {
        patch(oldEndVNode, newStartVNode, container)
        insert(oldEndVNode.el, container, oldStartVNode.el)
        // 更新索引
        oldEndVNode = oldChildren[--oldEndIdx]
        newStartVNode = newChildren[++newStartIdx]
      } else {
        // 遍历旧 children，试图找到与 newStartVNode 相同 key 的节点
        // idxInOld 就是相同 key 的旧节点索引
        const idxInOld = oldChildren.findIndex(
          node => node.key == newStartVNode.key
        )
        // idxInOld > 0，说明找到可复用节点
        if (idxInOld > 0) {
          // 拿到需要移动的节点
          const vnodeToMove = oldChildren[idxInOld]
          // 打补丁
          patch(vnodeToMove, newStartVNode, container)
          //移动节点
          insert(vnodeToMove.el, container, oldStartVNode.el)
          // 由于 idxInOld 索引处的节点对应的真实 DOM 已经移动，因此应设置为 undefined
          oldChildren[idxInOld] = undefined
          newStartVNode = newChildren[++newStartIdx]
        } else {
          // 作为新节点，插入到当前头部
          patch(null, newStartVNode, container, oldStartVNode.el)
        }
      }
    }
    // 循环结束后检查索引状态
    if (oldEndIdx < oldStartIdx && newStartIdx <= newEndIdx) {
      for (let i = newStartIdx; i < newEndIdx; i++) {
        patch(null, newChildren[i], container, oldStartVNode.el)
      }
    } else if (oldStartIdx <= oldEndIdx && newEndIdx < newStartIdx) {
      for (let i = oldStartIdx; i < oldEndIdx; i++) {
        unmount(oldChildren[i])
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
