import {shallowMount, createLocalVue} from '@vue/test-utils';
import VueRouter from 'vue-router'
import CoreuiVue from '@coreui/vue'
import Compose from '@/views/apps/email/Compose'

const localVue = createLocalVue()
localVue.use(VueRouter)
const router = new VueRouter()

localVue.use(CoreuiVue)

describe('Compose.vue', () => {
  it('has a name', () => {
    expect(Compose.name).toMatch('Compose')
  })
  it('is Vue instance', () => {
    const wrapper = shallowMount(Compose, {
      localVue,
      router
    })
    expect(wrapper.isVueInstance()).toBe(true)
  })
  it('is Compose', () => {
    const wrapper = shallowMount(Compose, {
      localVue,
      router
    })
    expect(wrapper.is(Compose)).toBe(true)
  })
  test('renders correctly', () => {
    const wrapper = shallowMount(Compose, {
      localVue,
      router
    })
    expect(wrapper.element).toMatchSnapshot()
  })
})

