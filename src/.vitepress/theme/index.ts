import DefaultTheme from 'vitepress/theme'
import type { App } from 'vue'
import './custom.css'
import PipelineInteractive from './components/PipelineInteractive.vue'
import CostTelemetryMatrix from './components/CostTelemetryMatrix.vue'
import TerminalDemo from './components/TerminalDemo.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }: { app: App }) {
    app.component('PipelineInteractive', PipelineInteractive)
    app.component('CostTelemetryMatrix', CostTelemetryMatrix)
    app.component('TerminalDemo', TerminalDemo)
  }
}
