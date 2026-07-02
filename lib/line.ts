import { messagingApi } from '@line/bot-sdk'

export function getLineConfig() {
  const channelSecret = process.env.LINE_CHANNEL_SECRET
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!channelSecret || !channelAccessToken) {
    throw new Error('LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN が未設定です')
  }
  return { channelSecret, channelAccessToken }
}

let _client: messagingApi.MessagingApiClient | null = null
let _blobClient: messagingApi.MessagingApiBlobClient | null = null

export function getLineClient() {
  if (!_client) {
    _client = new messagingApi.MessagingApiClient({
      channelAccessToken: getLineConfig().channelAccessToken,
    })
  }
  return _client
}

export function getLineBlobClient() {
  if (!_blobClient) {
    _blobClient = new messagingApi.MessagingApiBlobClient({
      channelAccessToken: getLineConfig().channelAccessToken,
    })
  }
  return _blobClient
}
