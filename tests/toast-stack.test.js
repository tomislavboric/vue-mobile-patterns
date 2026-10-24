// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import ToastStack from '../src/components/ToastStack.vue'
import { useToastQueue } from '../src/composables/useToastQueue.js'

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('ToastStack + useToastQueue', () => {
  function mountApp(options) {
    let api
    const App = defineComponent({
      setup() {
        api = useToastQueue(options)
        return () => h(ToastStack, { toasts: api.toasts.value, teleportTo: null, onDismiss: api.dismiss })
      },
    })
    const wrapper = mount(App, { attachTo: document.body })
    return { wrapper, api: () => api }
  }

  it('renders one row per toast with a ×N counter for repeats', async () => {
    const { wrapper, api } = mountApp()
    api().show('Saved', 'success')
    api().show('Saved', 'success')
    api().show('Offline', 'warn')
    await nextTick()
    const rows = wrapper.findAll('.vmp-toast')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Saved')
    expect(rows[0].find('.vmp-toast__count').text()).toBe('×2')
    expect(rows[1].classes()).toContain('vmp-toast--warn')
    wrapper.unmount()
  })

  it('announces errors as alerts and everything else as status', async () => {
    const { wrapper, api } = mountApp()
    api().show('Done', 'success')
    api().show('Failed', 'error')
    await nextTick()
    expect(wrapper.findAll('.vmp-toast').map(r => r.attributes('role'))).toEqual(['status', 'alert'])
    wrapper.unmount()
  })

  it('the close button dismisses that toast', async () => {
    const { wrapper, api } = mountApp()
    api().show('One', 'info')
    api().show('Two', 'info')
    await nextTick()
    await wrapper.findAll('.vmp-toast__close')[0].trigger('click')
    expect(api().toasts.value.map(t => t.text)).toEqual(['Two'])
    wrapper.unmount()
  })

  it('clears its timers when the owning component unmounts', () => {
    vi.useFakeTimers()
    const { wrapper, api } = mountApp()
    api().show('Saved', 'success')
    expect(vi.getTimerCount()).toBe(1)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
