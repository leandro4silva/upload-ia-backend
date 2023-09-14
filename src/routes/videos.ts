import { FastifyInstance } from "fastify";
import { fastifyMultipart } from '@fastify/multipart'
import path from "node:path";
import { randomUUID } from "node:crypto";
import fs from 'node:fs'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { prisma } from "../lib/prisma";
import { createReadStream } from 'node:fs'
import { z } from 'zod'
import { openai } from "../lib/openai";
import { text } from "node:stream/consumers";

const pump = promisify(pipeline)

export async function videos(app: FastifyInstance) {
  app.register(fastifyMultipart, {
    limits:{
      fileSize: 1_048_576 * 25 // 25mb
    }
  })

  app.post('/videos', async (request, reply) => {
    const data = await request.file()

    if(!data){
      return reply.status(400).send({
        error: 'MIssing file input'
      })
    }

    const extension = path.extname(data.filename)

    if(extension !== '.mp3'){
      return reply.status(400).send({
        error: 'Invalid input type, please upload a MP3.'
      })
    }

    const fileBaseName = path.basename(data.fieldname, extension)
    const fileUploadName = `${fileBaseName}-${randomUUID()}${extension}`
    const uploadDestination = path.resolve(__dirname, '../../tmp', fileUploadName)
    
    await pump(data.file, fs.createWriteStream(uploadDestination))

    const video = await prisma.video.create({
      data: {
        name: data.filename,
        path: uploadDestination
      }
    })

    return {
      video
    }
  })

  app.post('/videos/:videoId/transcription', async(request, reply) =>{
    const paramsSchema = z.object({
      videoId: z.string().uuid()
    })

    const { videoId } = paramsSchema.parse(request.params)

    const bodySchema = z.object({
      prompt: z.string()
    })

    const { prompt } = bodySchema.parse(request.body)

    const video = await prisma.video.findFirstOrThrow({
      where: {
        id: videoId
      }
    })

    const videoPath = video.path
    const audioReadStream = createReadStream(videoPath)

    const response = await openai.audio.transcriptions.create({
      file: audioReadStream,
      model: 'whisper-1',
      language: 'pt',
      response_format: 'json',
      temperature: 0,
      prompt,
    })

    const transcription = response.text

    await prisma.video.update({
      where: {
        id: videoId
      },
      data: {
        transcription
      }
    })

    return {
      transcription
    }
  })
}