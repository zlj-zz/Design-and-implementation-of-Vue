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
    // 对 class 进行特殊处理
    if (key === 'class') {
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
