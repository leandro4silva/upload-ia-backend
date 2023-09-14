import { fastify } from 'fastify'
import { fastifyCors } from '@fastify/cors'
import { prompts } from './routes/prompts'
import { videos } from './routes/videos'
import { ai } from './routes/ia'

const app = fastify()

app.register(fastifyCors, {
  origin: '*'
})

app.register(prompts)
app.register(videos)
app.register(ai)

app.listen({
  host: "0.0.0.0",
  port: 3333,
}).then(() => {
  console.log('HTTP Server Running')
})