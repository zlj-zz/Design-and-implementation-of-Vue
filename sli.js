function getSequence(arr) {
  // 复制一份 arr
  const p = arr.slice()

  const result = [0]
  let i, j, u, v, c
  const len = arr.length

  for (i = 0; i < len; i++) {
    // 获取当前索引 i 的值
    const arrI = arr[i]
    if (arrI !== 0) {
      // 获取 result 的最后一个值（arr 的索引）
      j = result[result.length - 1]
      // 如果索引对应的值小于当前值，满足子序列，添加
      if (arr[j] < arrI) {
        // 备份 i 在 result 中前面一个索引
        p[i] = j
        result.push(i)
        console.log(result)
        continue
      }

      // 二分查找法，找到 arrI 在 result 中的位置
      u = 0
      v = result.length - 1
      while (u < v) {
        // 获取中间的索引， 用 ｜ 向上取整
        c = ((u + v) / 2) | 0
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          v = c
        }
      }

      // 如果 arrI 小于对应位置的值
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          // 备份
          p[i] = result[u - 1]
        }
        // 更新子序列
        result[u] = i
      }
      console.log(result)
    }
  }
  console.log(result)

  // 获取子序列
  console.log(p)
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }

  return result
}




/** test */
console.log(getSequence([3, 6, 4, 2, 1, 0]))
