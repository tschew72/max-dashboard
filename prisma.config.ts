import { defineConfig } from 'prisma/config'

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:IttpQGczrT91qrdUEHENGsYvpnRIN6aa@127.0.0.1:5433/max_dashboard',
  },
})
