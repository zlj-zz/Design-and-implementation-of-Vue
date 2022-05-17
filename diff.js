function simpleDiff(n1, n2, container) {

  const oldChildren = n1.children
  const newChildren = n2.children

  // 存储寻找过程中遇到最大的索引值
  let lastIndex = 0
  // 遍历新的 children
  for (let i = 0; i < newChildren.length; i++) {
    const newVNode = newChildren[i]

    let j = 0
    // 在第一层循环中定义 find，代表是否在旧 children 中能找到
    let find = false
    // 遍历旧的 children
    for (let j = 0; j < oldChildren.length; j++) {
      const oldVNode = oldChildren[j]
      if (newVNode.key === oldVNode.key) {
        // 一旦找到可复用的节点，find 的值设置为 true
        find = true
        patch(oldVNode, newVNode, container)
        if (j < lastIndex) {
          // 如果当前节点在旧 children 中的索引值小于 lastIndex
          // 说明该节点对应的真实 DOM 需要移动

          // 先获取 newVNode 的前一个 vnode，即 preVNode
          const preVNode = newChildren[i - 1]
          // 如果 preVNode 不存在，则说明当前 newVNode 时第一个节点，它不需要移动
          if (preVNode) {
            const anchor = preVNode.el.nextSibling
            insert(newVNode.el, container, anchor)
          }
        } else {
          // 如果当前节点在旧 children 中的索引值不小于最大索引值
          // 则更新 lastIndex
          lastIndex = j
        }
        break
      }
    }
    // 如果到这里 find 仍为 false
    // 说明当前 newVNode 没有在旧 children 中找到可复用的节点
    // 则当前 newVNode 为新增节点，需要挂载
    if (!find) {
      const preVNode = newChildren[i - 1]
      let anchor = null
      if (preVNode) {
        anchor = preVNode.el.nextSibling
      } else {
        // 如果没有前一个 vnode，说明挂载的新节点是第一个字节点
        // 此时使用容器的 firstChild 作为锚点
        anchor = container.firstChild
      }
      patch(null, newVNode, container, anchor)
    }
  }
  // 重新遍历旧的 children
  for (let i = 0; i < oldChildren.length; i++) {
    const oldVNode = oldChildren[i]
    // 拿旧的 oldVNode 在 newChildren 中寻找是否有相同 key 的节点
    const has = newChildren.find(vnode => vnode.key === oldVNode.key)

    if (!has) {
      // 如果没有找到，说明需要删除该节点
      unmount(oldVNode)
    }
  }
}
