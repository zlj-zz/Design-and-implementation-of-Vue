function createRenderer(options) {
  const {
    createElement,
    insert,
    setElementText,
    patchProps,
  } = options
  // 在这个作用域定义的函数都可以访问

  function mountElement(vnode, container) {
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
    insert(el, container)
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
      // 说明新字节点是一组字节点
      if (Array.isArray(n1.children)) {
        // 旧字节点也是一组字节点
        // 这里涉及核心 Diff 算法
      } else {
        // 此时，旧字节点要么是文本，要么不存在
        // 设置文本为空，逐个挂载新的一组字节点
        setElementText(container, '')
        n2.children.forEach(c => patch(null, c, container))
      }
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

  function patch(n1, n2, container) {
    if (n1 && n1.type !== n2.type) {
      unmount(n1)
      n1 = null
    }
    // 运行到这，证明 n1 和 n2 所描述的内容相同
    const { type } = n2
    // 如果 n2.type 的值是字符串类型，则它描述的是普通标签元素
    if (typeof type === 'string') {
      if (!n1) {
        mountElement(n1, n2, container)
      } else {
        // 更新
        patchElement(n1, n2)
      }
    } else if (typeof type === 'object') {
      //如果 n2.type 的值是类型对象，则它描述的是组件
    } else if (type === 'xxx') {
      // 处理其他类型 vnode
    }
  }

  function unmount(vnode) {
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
