import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const missing = REQUIRED_ENV.filter((name) => !env[name])

  // Vite inlines these at build time, so a build without them produces a bundle that can only
  // ever render the "not configured" screen — the rest of the app is dead code and gets
  // dropped. That deploys and serves happily, so the build has to be what fails.
  if (command === 'build' && missing.length > 0) {
    throw new Error(
      `Не заданы переменные окружения: ${missing.join(', ')}.\n` +
        'Задайте их в настройках проекта (Vercel → Settings → Environment Variables) ' +
        'или в файле .env — см. .env.example.',
    )
  }

  return { plugins: [react(), tailwindcss()] }
})
