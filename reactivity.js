const bucket = new WeakMap()
let activeEffect // 全局变量，当前被激活的 effect 函数
const effectStack = []
// 存储原始对象到代理对象的映射
const reactiveMap = new Map()

const TriggerType = {
  SET: 'SET',
  ADD: 'ADD',
  DELETE: 'DELETE'
}

function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i]
    // 将 effectFn 从依赖集合中移除
    deps.delete(effectFn)
  }
  // 最后重置
  effectFn.deps.length = 0
}

function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn)
    activeEffect = effectFn
    // 调用前压栈当前 effect
    effectStack.push(effectFn)
    const res = fn()
    // 调用后弹栈，并将 activeEffect 还原
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]

    return res
  }
  //  将 options 挂载到 effectFn 上
  effectFn.options = options
  // effectFn.deps 存储当前所有与副作用函数相关联的依赖集合
  effectFn.deps = []

  // 只有非 lazy 时，才执行
  if (!options.lazy) {
    effectFn()
  }
  // 将副作用函数作为返回值返回
  return effectFn
}

function track(target, key) {
  if (!activeEffect || !shouldTrack) return
  //  根据 target 从桶中取得 depsMap， 一个 Map 类型： key --> effects
  let depsMap = bucket.get(target)
  // 如果不存在， 新建一个 Map 与 target 关联
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }
  // 根据 key 从 depsMap 中取得 deps，一个 Set 类型
  // 存储当前 key 相关联的副作用函数：effects
  let deps = depsMap.get(key)
  if (!deps) {
    depsMap.set(key, (deps = new Set()))
  }
  // 添加当前激活的副作用函数到桶中
  deps.add(activeEffect)
  // deps 就是一个与当前副作用函数存在关联的依赖集合
  // 添加到 activeEffect.deps 数组中
  activeEffect.deps.push(deps)
}

function trigger(target, key, type, newVal) {
  //  根据 target 从桶中取得 depsMap， 一个 Map 类型： key --> effects
  const depsMap = bucket.get(target)
  if (!depsMap) return

  const effectsToRun = new Set()

  // 根据 key 取得所有的 effects
  const effects = depsMap.get(key)
  effects && effects.forEach(effectFn => {
    // 如果 trigger 触发的副作用与当前执行的副作用相同，则不触发执行
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn)
    }
  })

  //
  if (type === 'ADD' || type === 'DELETE' ||
    // 如果操作是 SET，且目标是 Map 类型
    // 也应该触发与 ITERATE_KEY 相关联的副作用函数执行
    (type === 'SET' && Object.prototype.toString.call(target) === '[object Map]')) {
    // obj 相关联的副作用
    const iterateEffects = depsMap.get(ITERATE_KEY)
    iterateEffects && iterateEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }

  if (
    // 操作是 ADD 或 DELETE
    (type === 'ADD' || type === 'DELETE') &&
    // 并且是 Map 类型的数据
    Object.prototype.toString.call(target) === '[object Map]') {
    // 则取出与 MAP_KEY_ITERATE_KEY 相关联的副作用函数执行
    const iterateEffects = depsMap.get(MAP_KEY_ITERATE_KEY)
    iterateEffects && iterateEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }

  // 当操作类型为 ADD，目标为数组，应取出执行与 length 属性相关的副作用函数
  if (type === 'ADD' && Array.isArray(target)) {
    // 取出 length 相关的副作用
    const lengthEffects = depsMap.get('length')
    lengthEffects && lengthEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }

  // 如果操作目标是数组，并修改了数组的 length 属性
  if (Array.isArray(target) && key === 'length') {
    // 对与索引大于等于新的 length 值的元素，
    // 需要把所有关联的副作用函数取出并添加到 effectsToRun 中待执行
    depsMap.forEach((effects, key) => {
      if (key >= newVal) {
        effects.forEach(effectFn => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
          }
        })
      }
    })
  }

  // 执行 effects
  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
}

const ITERATE_KEY = Symbol()
const MAP_KEY_ITERATE_KEY = Symbol()

const arrayInstrumentations = {}
  ;['include', 'indexOf', 'lastIndexOf'].forEach(method => {
    const originMethod = Array.prototype[method]
    arrayInstrumentations[method] = function (...args) {
      // this 是代理对象，现在代理对象中查找，结果存到 res 中
      let res = originMethod.apply(this, args)

      if (res === false) {
        // res 为 false 说明没找到，通过 this.raw 拿到原始数组，重新查找并更新 res
        res = originMethod.apply(this.raw, args)
      }

      return res
    }
  })
let shouldTrack = true
  ;['push', 'pop', 'shift', 'unshift', 'splice'].forEach(method => {
    const originMethod = Array.prototype[method]
    // 重写
    arrayInstrumentations[method] = function (...args) {
      // 调用原始方法前，禁止追踪
      shouldTrack = false
      let res = originMethod.apply(this, args)
      // 调用原始方法后，恢复，允许追踪
      shouldTrack = true
      return res
    }
  })

const mutableInstrumentations = {
  get(key) {
    const target = this.raw
    const had = target.has(key)
    track(target, key)
    // 如果存在，则返回结果。这里得到的结果仍然是可代理的数据
    // 则要返回 reactive 包装后的响应式数据
    if (had) {
      const res = target.get(kek)
      return typeof res === 'object' ? reactive(res) : res
    }
  },
  set(key, value) {
    const target = this.raw
    const had = target.has(key)
    const oldVal = target.get(key)

    const rawValue = value.raw || value
    target.set(key, rawValue)

    // 如果不存在，则说明是 ADD 操作，否则是 SET 操作
    if (!had) {
      trigger(target, key, 'ADD')
    } else if (oldVal !== value || (oldVal === oldVal && value === value)) {
      trigger(target, key, 'SET')
    }

  },
  add(key) {
    // this 仍然指向代理对象，通过 raw 获取原属对象
    const target = this.raw

    // 先判断值是否存在
    const hadKey = target.has(key)
    // 通过原始对象执行 add 方法
    // 注意这里不再需要 .bind 了，因为直接通过 target 调用
    const res = target.add(key)
    // 不存在才需要触发响应
    if (!hadKey) {
      // 调用 trigger 触发响应，并指定操作为 ADD
      trigger(target, key, 'ADD')
    }

    return res
  },
  delete(key) {
    const target = this.raw
    const hadKey = target.has(key)
    const res = target.delete(key)
    // 删除属性存在才触发响应
    if (!hadKey) {
      trigger(target, key, 'DELETE')
    }
    return res
  },
  forEach(callback, thisArg) {
    // wrap 把可代理的值转换成响应式数据
    const wrap = (val) => typeof val == 'object' ? reactive(val) : val

    const target = this.raw
    track(target, ITERATE_KEY)
    target.forEach((v, k) => {
      // 手动调用 callback，用 wrap 包裹参数实现响应式
      callback(thisArg, wrap(v), wrap(k), this)
    })
  },
  [Symbol.iterator]: createIterationMethod(IterationType.ENTRIES),
  entries: createIterationMethod(IterationType.ENTRIES),
  values: createIterationMethod(IterationType.VALUES),
  keys: createIterationMethod(IterationType.KEYS),

}

const IterationType = {
  KEYS: 'KEYS',
  VALUES: 'VALUES',
  ENTRIES: 'ENTRIES'
}

function createIterationMethod(type) {
  return function iterationMethod() {
    const target = this.raw
    let itr
    if (type === IterationType.ENTRIES) {
      itr = target[Symbol.iterator]()
    } else if (type === IterationType.KEYS) {
      itr = target.keys()
    } else if (type === IterationType.VALUES) {
      itr = target.values()
    }

    const wrap = (val) => typeof val == 'object' ? reactive(val) : val

    type === IterationType.KEYS ? track(target, MAP_KEY_ITERATE_KEY) : track(target, ITERATE_KEY)

    return {
      next() {
        const { value, done } = itr.next()
        return {
          value: value
            ? type === IterationType.ENTRIES ?
              [wrap(value[0]), wrap(value[1])] : wrap(value)
            : value,
          done
        }
      },
      // 实现可迭代协议
      [Symbol.iterator]() {
        return this
      }
    }
  }
}

function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      // 代理对象可以通过 raw 属性访问原始数据
      if (key === 'raw') return target

      if (Object.prototype.toString.call(target) in ['[object Set]', '[object Map]'] &&
        mutableInstrumentations.hasOwnProperty(key)) {

        if (key === 'size') {
          // 如果是 size 属性
          track(target, ITERATE_KEY)
          return Reflect.get(target, key, target)
        }
        // 如果 target 是个 Set 或 Map，且 key 在 mutableInstrumentations 中
        // 返回定义在 mutableInstrumentations 对象下的方法
        return mutableInstrumentations[key]
      }

      // 如果操作目标是数组，且 key 存在 arrayInstrumentations 上
      // 那么返回定义在 arrayInstrumentations 上的值
      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver)
      }

      // 非只读时才需要建立相应关系
      // 如果 key 是 Symbol，则不进行追踪
      if (!isReadonly && typeof key !== 'symbol') {
        track(target, key)
      }

      // 获取到原始结果
      const res = Reflect.get(target, key, receiver)

      // 如果是浅响应
      if (isShallow) {
        return res
      }

      if (typeof res === 'object' && res !== null) {
        // 调用 reactive  将结果包装成响应式数据并返回
        // 如果数据只读，则使用 readonly 进行包装
        return isReadonly ? readonly(res) : reactive(res)
      }

      return res
    },
    set(target, key, newVal, receiver) {
      // 如果是只读的，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性 ${key} 为只读`)
        return true
      }

      const oldVal = target[key]
      // 检查属性是否存在
      const type = Array.isArray(target)
        // 如果代理目标时数组，则检查被设置的索引值是否小于数组长度
        // 如果 true，则视作 SET，否则为 ADD
        ? Number(key) < target.length ? 'SET' : 'ADD'
        : Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'

      // 设置
      const res = Reflect.set(target, key, newVal, receiver)

      // 说明 receiver 就是 target 的代理对象
      if (target === receiver.raw) {
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          trigger(target, key, type, newVal)
        }
      }

      return res
    },
    has(target, key) {
      track(target, key)
      return Reflect.has(target, key)
    },
    ownKeys(target) {
      // 将副作用与 ITERATE_KEY 关联
      // 如果操作 target 是数组，则使用 length 属性作为 key 建立响应式关联
      track(target, Array.isArray(target) ? 'length' : ITERATE_KEY)
      return Reflect.ownKeys(target)
    },
    deleteProperty(target, key) {
      // 如果是只读的，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性 ${key} 为只读`)
        return true
      }

      const hadKey = Object.prototype.hasOwnProperty.call(target, key)
      const res = Reflect.deleteProperty(target, key)

      if (res && hadKey) {
        trigger(target, key, 'DELETE')
      }
      return res
    }
  })
}

function reactive(obj) {
  // 优先查询是否存在代理，若存在直接返回已有的代理
  const existionProxy = reactiveMap.get(obj)
  if (existionProxy) return existionProxy

  // 否则，创建新的代理对象
  const proxy = createReactive(obj)
  // 存储到 Map 中，防止重复创建
  reactiveMap.set(obj, proxy)
  return proxy
}

function shallowReactive(obj) {
  return createReactive(obj, true)
}

function readonly(obj) {
  return createReactive(obj, false, true /* 只读 */)
}

function shallowReadonly(obj) {
  return createReactive(obj, true /* shallow */, true)
}

function computed(getter) {
  let value
  let dirty = true

  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      dirty = true
      //  计算属性依赖的响应式数据变化时，手动调用 trigger 触发响应
      trigger(obj, 'value')
    }
  })

  const obj = {
    get value() {
      if (dirty) {
        value = effectFn()
        dirty = false
      }
      // 读取 value 时，手动调用 track 进行追踪
      track(obj, 'value')
      return value
    }
  }

  return obj
}

function watch(source, cb, options = {}) {
  let getter
  if (typeof source === 'function') {
    getter = source
  } else {
    getter = () => traverse(source)
  }

  let oldValue, newValue

  let cleanup // 存储用户注册的过期回调
  // 定义 onInvalidate 函数
  function onInvalidate(fn) {
    cleanup = fn
  }

  const job = () => {
    newValue = effectFn()
    // 调用 cb 前，调用过期回调
    if (cleanup) {
      cleanup()
    }
    // 数据变化时调用 cb
    cb(newValue, oldValue, onInvalidate)
    oldValue = newValue
  }

  const effectFn = effect(
    () => getter(),
    {
      lazy: true,
      scheduler: () => {
        if (options.flush === 'post') {
          const p = Promise.resolve()
          p.then(job)
        } else {
          job()
        }
      }
    })

  if (options.immediate) {
    job()
  } else {
    oldValue = effectFn()
  }
}

function traverse(value, seen = new Set()) {
  if (typeof value !== 'object' || value === null || seen.has(value)) return
  // 避免循环引用
  seen.add(value)
  // 认为 value 是一个 对象，暂不考虑其他结构
  for (const k in value) {
    traverse(value[k], seen)
  }

  return value
}

function ref(val) {
  const wrapper = {
    value: val
  }
  // 使用 Object.defineProperty 在 wrapper 上定义一个不可枚举属性 __v_isRef，并设置为 true
  Object.defineProperty(wrapper, '__v_isRef', {
    value: true
  })

  return reactive(wrapper)
}

function shallowRef(val) {
  const wrapper = {
    value: val
  }
  // 使用 Object.defineProperty 在 wrapper 上定义一个不可枚举属性 __v_isRef，并设置为 true
  Object.defineProperty(wrapper, '__v_isRef', {
    value: true
  })

  return shallowReactive(wrapper)
}

function toRef(obj, key) {
  const wrapper = {
    get value() {
      return obj[key]
    },
    // 允许设置值
    set value(val) {
      obj[key] = val
    }
  }

  Object.defineProperty(wrapper, '__v_isRef', {
    value: true
  })

  return wrapper
}

function toRefs(obj) {
  const ret = {}
  // 遍历对象
  for (const key in obj) {
    // 逐个调用 toRef 完成代理转换
    ret[key] = toRef(obj, key)
  }

  return ret
}

function proxyRefs(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver)
      // 自动脱 ref实现，如果值是 ref，则返回它的 value 属性值
      return value.__v_isRef ? value.value : value
    },
    set(target, key, newValue, receiver) {
      const value = target[key]
      // 如果值是 ref，设置其对应的 value 属性
      if (value.__v_isRef) {
        value.value = newValue
        return true
      }

      return Reflect.set(target, key, newValue, receiver)
    }
  })
}

export { effect, reactive, shallowReactive, shallowReadonly, ref, shallowRef, toRef }


/** test part */
const obj = shallowReactive({ foo: { bar: 1 } })
// const obj = reactive({ foo: { bar: 1 } })
effect(() => {
  console.log(obj.foo.bar)
})
obj.foo = { bar: 2 }
obj.foo.bar = 3

const arr = reactive([])
effect(() => {
  arr.push(1)
})
effect(() => {
  arr.push(2)
})
