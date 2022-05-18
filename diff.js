/** 简单 diff 算法 */
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

/** 双端 diff 算法 */
function doubleEndDiff(n1, n2, container) {

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
