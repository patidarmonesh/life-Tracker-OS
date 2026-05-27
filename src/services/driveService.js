import { getAccessToken } from './authService'

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files'

const ROOT_FOLDER_NAME =
  import.meta.env.VITE_DRIVE_FOLDER_NAME ||
  import.meta.env.VITEDRIVEFOLDERNAME ||
  'LifeOS-Data'

const ROOT_FOLDER_ID_KEY = 'lifeos_drive_folder_id'
const BILLS_FOLDER_ID_KEY = 'lifeos_drive_bills_folder_id'

const DEFAULT_FILES = {
  'finance.json': { expenses: [], budgets: {}, categories: [], bills: [] },
  'timeflow.json': { entries: [] },
  'study.json': { sessions: [], goals: {}, subjects: [] },
  'habits.json': { checkpoints: [], dailyLogs: [] },
  'health.json': { imported: {}, manualLogs: [] },
  'journal.json': { entries: [] },
  'settings.json': { profile: {}, preferences: {} },
  'aiChat.json': { messages: [] },
}

const debounceMap = new Map()

function getHeaders(extra = {}) {
  const token = getAccessToken()
  if (!token) throw new Error('No Google access token found')

  return {
    Authorization: `Bearer ${token}`,
    ...extra,
  }
}

async function driveFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Drive request failed: ${res.status} ${text}`)
  }

  return res
}

function escapeDriveQueryValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function findFolderByName(folderName, parentFolderId = null) {
  const parts = [
    `name='${escapeDriveQueryValue(folderName)}'`,
    `mimeType='application/vnd.google-apps.folder'`,
    'trashed=false',
  ]

  if (parentFolderId) {
    parts.push(`'${parentFolderId}' in parents`)
  }

  const query = encodeURIComponent(parts.join(' and '))
  const res = await driveFetch(`${DRIVE_API}?q=${query}&fields=files(id,name,parents)`)
  const data = await res.json()
  return data.files?.[0] || null
}

async function createFolder(folderName, parentFolderId = null) {
  const body = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  }

  if (parentFolderId) {
    body.parents = [parentFolderId]
  }

  const res = await driveFetch(DRIVE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return res.json()
}

async function ensureFolder(folderName, storageKey, parentFolderId = null) {
  const cachedId = localStorage.getItem(storageKey)
  if (cachedId) return cachedId

  const existing = await findFolderByName(folderName, parentFolderId)
  if (existing?.id) {
    localStorage.setItem(storageKey, existing.id)
    return existing.id
  }

  const created = await createFolder(folderName, parentFolderId)
  localStorage.setItem(storageKey, created.id)
  return created.id
}

export async function initializeDrive() {
  return ensureFolder(ROOT_FOLDER_NAME, ROOT_FOLDER_ID_KEY)
}

export async function ensureBillsFolder() {
  const rootFolderId = await initializeDrive()
  return ensureFolder('Bills', BILLS_FOLDER_ID_KEY, rootFolderId)
}

export function getDriveFolderId() {
  return localStorage.getItem(ROOT_FOLDER_ID_KEY)
}

export function getBillsFolderId() {
  return localStorage.getItem(BILLS_FOLDER_ID_KEY)
}

async function findFileInFolder(fileName, folderId) {
  const query = encodeURIComponent(
    `name='${escapeDriveQueryValue(fileName)}' and '${folderId}' in parents and trashed=false`
  )
  const res = await driveFetch(`${DRIVE_API}?q=${query}&fields=files(id,name,modifiedTime,parents)`)
  const data = await res.json()
  return data.files?.[0] || null
}

export async function getFile(fileName) {
  const folderId = await initializeDrive()
  const file = await findFileInFolder(fileName, folderId)

  if (!file) return null

  const res = await driveFetch(`${DRIVE_API}/${file.id}?alt=media`)
  return res.json()
}

export async function saveFile(fileName, data) {
  const folderId = await initializeDrive()
  const existing = await findFileInFolder(fileName, folderId)

  const metadata = existing
    ? { name: fileName }
    : {
        name: fileName,
        mimeType: 'application/json',
        parents: [folderId],
      }

  const boundary = 'lifeosboundary'
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${JSON.stringify(data, null, 2)}\r\n` +
    `--${boundary}--`

  const url = existing
    ? `${UPLOAD_API}/${existing.id}?uploadType=multipart&fields=id,name,modifiedTime`
    : `${UPLOAD_API}?uploadType=multipart&fields=id,name,modifiedTime`

  const res = await driveFetch(url, {
    method: existing ? 'PATCH' : 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })

  return res.json()
}

export async function uploadBase64FileToDrive({
  fileName,
  mimeType,
  base64Data,
  parentFolderId,
}) {
  const folderId = parentFolderId || (await ensureBillsFolder())

  const metadata = {
    name: fileName,
    parents: [folderId],
  }

  const boundary = 'lifeosfileuploadboundary'
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType || 'application/octet-stream'}\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    `${base64Data}\r\n` +
    `--${boundary}--`

  const res = await driveFetch(
    `${UPLOAD_API}?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,parents`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )

  return res.json()
}

export async function ensureInitialFiles() {
  await initializeDrive()
  await ensureBillsFolder()

  const names = Object.keys(DEFAULT_FILES)

  await Promise.all(
    names.map(async fileName => {
      const existing = await getFile(fileName)
      if (!existing) {
        await saveFile(fileName, DEFAULT_FILES[fileName])
      }
    })
  )
}

export async function syncAll() {
  const entries = await Promise.all(
    Object.keys(DEFAULT_FILES).map(async fileName => {
      const content = await getFile(fileName)
      return [fileName, content ?? DEFAULT_FILES[fileName]]
    })
  )

  return Object.fromEntries(entries)
}

export function autoSave(fileName, data, delay = 1000) {
  const key = fileName

  if (debounceMap.has(key)) {
    clearTimeout(debounceMap.get(key).timeoutId)
  }

  let resolvePromise
  let rejectPromise

  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  const timeoutId = setTimeout(async () => {
    try {
      const result = await saveFile(fileName, data)
      resolvePromise(result)
    } catch (error) {
      console.error(`Auto-save failed for ${fileName}`, error)
      rejectPromise(error)
    } finally {
      debounceMap.delete(key)
    }
  }, delay)

  debounceMap.set(key, { timeoutId, promise })

  return promise
}

// 🔥 FIX 6: New function to delete ALL files from Google Drive
export async function deleteAllFiles() {
  try {
    const folderId = await initializeDrive()
    const billsFolderId = await ensureBillsFolder()

    // Delete all JSON files
    const names = Object.keys(DEFAULT_FILES)
    await Promise.all(
      names.map(async fileName => {
        try {
          const file = await findFileInFolder(fileName, folderId)
          if (file) {
            await driveFetch(`${DRIVE_API}/${file.id}`, { method: 'DELETE' })
          }
        } catch (error) {
          console.error(`Failed to delete ${fileName}:`, error)
        }
      })
    )

    // Delete bills folder contents
    try {
      const billsQuery = encodeURIComponent(`'${billsFolderId}' in parents and trashed=false`)
      const res = await driveFetch(`${DRIVE_API}?q=${billsQuery}&fields=files(id)`)
      const data = await res.json()

      await Promise.all(
        (data.files || []).map(file =>
          driveFetch(`${DRIVE_API}/${file.id}`, { method: 'DELETE' }).catch(err =>
            console.error(`Failed to delete bill ${file.id}:`, err)
          )
        )
      )
    } catch (error) {
      console.error('Failed to delete bills:', error)
    }

    console.log('All files deleted from Google Drive')
  } catch (error) {
    console.error('Failed to delete all files:', error)
    throw error
  }
}

export function clearDriveCache() {
  localStorage.removeItem(ROOT_FOLDER_ID_KEY)
  localStorage.removeItem(BILLS_FOLDER_ID_KEY)
}

export function getDefaultDriveFiles() {
  return structuredClone(DEFAULT_FILES)
}
