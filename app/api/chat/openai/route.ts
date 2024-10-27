import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import { ServerRuntime } from "next"
import OpenAI from "openai"

import { CohereClient } from "cohere-ai"
import { supabase } from "@/lib/supabase/browser-client"

export const runtime: ServerRuntime = "edge"

async function call_extractor(content: string) {
  let system_prompt = `You are an assistant who formulates identifies intent from questions
  
  Each question will be asking for the location of something. Even if not explictally mentioned the user is always looking
  for a page on a particular universities website.

  Within the question a very small description of the page that the user is looking for is included.

  Your role then is given a user's question you are to extract the description of the page the user is looking for
  `

  let prompt = `Here is the user question:
  ${content}

  Extract a precise search query based on the description of the page 
  `

  const openai = new OpenAI()
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: system_prompt },
      { role: "user", content: prompt }
    ]
  })

  return response.choices[0].message.content
}

async function embed_search_query(query: string) {
  console.log("EMBEDDING:")
  console.log(query)
  let co_api_key = process.env.CO_API_KEY

  const EMBEDDING_MODEL = "embed-english-v3.0"

  const cohere = new CohereClient({ token: co_api_key })
  const embedded_query = await cohere.embed({
    texts: [query],
    model: EMBEDDING_MODEL,
    inputType: "search_query"
  })

  return embedded_query.embeddings
}

async function retrive_links(embedding: number[]) {
  const data = await supabase.rpc("match_link_descriptions", {
    query_embedding: embedding,
    match_threshold: 0,
    match_count: 2
  })

  return data.data
}

interface link_data {
  url: string
  description: string
}

async function get_next_cm(
  user_query: string,
  relevant_data: Array<link_data>
) {
  let system_prompt = `You are a navigation assistant who helps students navigate the York University website
  
  Another assistant has already located potentially relevant links for a user's query, your job is given a list 
  of potentially relevant links, their descriptions and the user's query respond to the user's query.

  Do this by determining which links are relevant and then returning a nicely formatted response to the users query.
  Make sure this response includes the relevant links and some description of what the links contain.

  Respond professionally and with a well formatted message.
  Remeber to only include the relevant links, and you can rewrite their descriptions to be more verbose or accurate to the user query but do not make up information about what the links contain.
  `
  let links_string = ""

  for (let i = 0; i < relevant_data.length; i++) {
    links_string += `${i}: link: ${relevant_data[i].url}, description: ${relevant_data[i].description} \n`
  }

  let prompt = `Here is the user query:
  ${user_query}

  Here is a list of all the potentially relevant links and their descriptions, as identified by another assistant:
  ${links_string}

  Respond to the user's query
  `

  const openai = new OpenAI()
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: system_prompt },
      { role: "user", content: prompt }
    ],
    stream: true
  })

  const stream = OpenAIStream(response)
  return stream
}

async function extract_search_query(user_query: string) {
  const search_query = await call_extractor(user_query)

  if (search_query == null) {
    return
  }
  const embeded_query = (await embed_search_query(search_query)) as number[][]

  return embeded_query
}

async function get_york_agent_response(messages: any[]) {
  const last_message = messages[messages.length - 1]
  const user_query = last_message["content"]

  const search_query = (await extract_search_query(user_query)) as number[][]
  const relevant_links = await retrive_links(search_query[0])

  if (relevant_links == null) {
    return
  }

  let relevant_data = []
  for (let i = 0; i < relevant_links.length; i++) {
    relevant_data.push({
      url: relevant_links[i]["url"],
      description: relevant_links[i]["description"]
    })
  }

  const response = await get_next_cm(user_query, relevant_data)
  return response
}

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages } = json as {
    chatSettings: ChatSettings
    messages: any[]
  }

  try {
    const stream = await get_york_agent_response(messages)
    if (stream === undefined) {
      return new Response(
        JSON.stringify({ messages: "An unexpected error occured" }),
        { status: 500 }
      )
    }
    return new StreamingTextResponse(stream)
  } catch (error: any) {
    let errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500

    if (errorMessage.toLowerCase().includes("api key not found")) {
      errorMessage =
        "OpenAI API Key not found. Please set it in your profile settings."
    } else if (errorMessage.toLowerCase().includes("incorrect api key")) {
      errorMessage =
        "OpenAI API Key is incorrect. Please fix it in your profile settings."
    }

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
