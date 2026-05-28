import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import {
  sampleExpenses,
  sampleSessions,
  sampleCheckpoints,
  sampleHabitLogs,
  sampleTimeEntries,
  sampleJournal,
  sampleHealthLogs,
  sampleSettings,
} from '../data/sampleData'
import {
  syncAll,
  autoSave,
  ensureInitialFiles,
  deleteAllFiles,
  clearDriveCache,
} from '../services/driveService'
import { getAccessToken } from '../services/authService'

const STORAGE_KEY = 'lifeos-app-state-v1'
const LAST_SYNC_KEY = 'lifeos-last-sync-time'

const initialState = {
  finance: { expenses: [], budgets: {}, categories: [], bills: [] },
  timeflow: { entries: [] },
  study: { sessions: [], goals: {}, subjects: [] },
  habits: { checkpoints: [], dailyLogs: [] },
  health: { imported: {}, manualLogs: [] },
  journal: { entries: [] },
  settings: {
    profile: {
      name: 'Ravish',
      avatar: '🧠',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
    },
    preferences: {
      dailyStudyGoal: 6,
      monthlyBudget: 15000,
      dailyWasteLimit: 2,
      sleepGoal: 8,
      dailyStepGoal: 10000,
      theme: 'dark',
      geminiApiKey: '',
      notificationsEnabled: true,
      dailyCheckinReminder: '21:00',
      budgetAlertAt: 80,
      streakRiskWarning: true,
      weeklyReportDay: 'Sunday',
      expenseCategories: [
        'Food',
        'Drinks',
        'Groceries',
        'Transport',
        'Gym Fitness',
        'Study Education',
        'Shopping',
        'Bills Utilities',
        'Health Medical',
        'Entertainment',
        'Subscriptions',
        'Travel',
        'Personal Care',
        'Gifts',
        'Miscellaneous',
      ],
      timeCategories: [
        'Sleep',
        'Morning Routine',
        'Exercise',
        'Study',
        'Deep Work',
        'Meals',
        'Social Media',
        'Entertainment',
        'Travel',
        'Self-Care',
        'Waste Time',
        'Other',
      ],
    },
  },
  aiChat: { messages: [] },
  syncStatus: 'idle',
  lastSynced: null,
  lastRemoteModified: null,
  remoteMetadata: {},
  hydrated: false,
  isFromDrive: false, // Track if data came from Google Drive
}

const MODULE_FILE_MAP = {
  finance: 'finance.json',
  timeflow: 'timeflow.json',
  study: 'study.json',
  habits: 'habits.json',
  health: 'health.json',
  journal: 'journal.json',
  settings: 'settings.json',
  aiChat: 'aiChat.json',
}

function buildSampleState() {
  return {
    ...initialState,
    finance: {
      expenses: sampleExpenses || [],
      budgets: { monthly: sampleSettings?.monthlyBudget || 8000 },
      categories:
        sampleSettings?.categories?.expense ||
        initialState.settings.preferences.expenseCategories,
      bills: [],
    },
    study: {
      sessions: sampleSessions || [],
      goals: { dailyHours: 6 },
      subjects: ['Machine Learning', 'DSA', 'Deep RL'],
    },
    habits: {
      checkpoints: sampleCheckpoints || [],
      dailyLogs: sampleHabitLogs || [],
    },
    timeflow: {
      entries: sampleTimeEntries || [],
    },
    journal: {
      entries: sampleJournal || [],
    },
    health: {
      imported: {},
      manualLogs: sampleHealthLogs || [],
    },
    settings: {
      ...initialState.settings,
      ...sampleSettings,
      profile: {
        ...initialState.settings.profile,
        ...(sampleSettings?.profile || {}),
      },
      preferences: {
        ...initialState.settings.preferences,
        ...(sampleSettings?.preferences || {}),
      },
    },
    syncStatus: 'synced',
    lastSynced: new Date().toISOString(),
    lastRemoteModified: null,
    remoteMetadata: {},
    hydrated: true,
    isFromDrive: false,
  }
}

function buildClearedState() {
  return {
    ...mergeWithInitialState(),
    syncStatus: 'synced',
    lastSynced: new Date().toISOString(),
    lastRemoteModified: null,
    remoteMetadata: {},
    hydrated: true,
    isFromDrive: false,
  }
}

function mergeWithInitialState(data = {}) {
  return {
    ...initialState,
    ...data,
    finance: {
      ...initialState.finance,
      ...(data.finance || {}),
      bills: data.finance?.bills || [],
    },
    timeflow: {
      ...initialState.timeflow,
      ...(data.timeflow || {}),
    },
    study: {
      ...initialState.study,
      ...(data.study || {}),
    },
    habits: {
      ...initialState.habits,
      ...(data.habits || {}),
    },
    health: {
      ...initialState.health,
      ...(data.health || {}),
    },
    journal: {
      ...initialState.journal,
      ...(data.journal || {}),
    },
    settings: {
      profile: {
        ...initialState.settings.profile,
        ...(data.settings?.profile || {}),
      },
      preferences: {
        ...initialState.settings.preferences,
        ...(data.settings?.preferences || {}),
      },
    },
    aiChat: {
      ...initialState.aiChat,
      ...(data.aiChat || {}),
    },
    lastRemoteModified: data.lastRemoteModified || null,
    remoteMetadata: data.remoteMetadata || {},
  }
}

function driveDataToAppState(files) {
  return mergeWithInitialState({
    finance: files['finance.json'],
    timeflow: files['timeflow.json'],
    study: files['study.json'],
    habits: files['habits.json'],
    health: files['health.json'],
    journal: files['journal.json'],
    settings: files['settings.json'],
    aiChat: files['aiChat.json'],
  })
}

function syncResultToAppState(syncResult) {
  return {
    ...driveDataToAppState(syncResult.files),
    remoteMetadata: syncResult.metadata || {},
    lastRemoteModified: syncResult.latestRemoteModified || null,
  }
}

function hasRemoteStateChanged(remoteMetadata = {}, currentMetadata = {}) {
  const fileNames = Object.values(MODULE_FILE_MAP)

  return fileNames.some(fileName => {
    const remote = remoteMetadata[fileName] || null
    const current = currentMetadata[fileName] || null

    if (!remote && !current) return false
    if (!remote || !current) return true

    return (
      remote.id !== current.id ||
      (remote.modifiedTime || '') !== (current.modifiedTime || '')
    )
  })
}

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE_STATE':
      return {
        ...state,
        ...action.data,
        hydrated: true,
      }

    case 'SET_MODULE':
      return {
        ...state,
        [action.module]: action.data,
        syncStatus: action.syncStatus || 'synced',
        lastSynced: action.time || new Date().toISOString(),
      }

    case 'PATCH_MODULE':
      return {
        ...state,
        [action.module]: {
          ...state[action.module],
          ...action.data,
        },
        syncStatus: action.syncStatus || 'synced',
        lastSynced: action.time || new Date().toISOString(),
      }

    case 'SET_SYNC_STATUS':
      return {
        ...state,
        syncStatus: action.status,
        lastSynced: action.time || state.lastSynced,
      }

    case 'SET_REMOTE_METADATA':
      return {
        ...state,
        remoteMetadata: {
          ...state.remoteMetadata,
          [action.fileName]: {
            ...(state.remoteMetadata[action.fileName] || {}),
            ...(action.metadata || {}),
          },
        },
        lastRemoteModified:
          action.metadata?.modifiedTime || state.lastRemoteModified,
        syncStatus: action.syncStatus || state.syncStatus,
        lastSynced: action.time || state.lastSynced,
      }

    case 'SET_SETTINGS':
      return {
        ...state,
        settings: {
          profile: {
            ...state.settings.profile,
            ...(action.data.profile || {}),
          },
          preferences: {
            ...state.settings.preferences,
            ...(action.data.preferences || {}),
          },
        },
        syncStatus: action.syncStatus || 'synced',
        lastSynced: action.time || new Date().toISOString(),
      }

    case 'RESET_TO_SAMPLE':
      return buildClearedState()

    default:
      return state
  }
}

const AppContext = createContext(null)

let syncIntervalId = null

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const remoteMetadataRef = useRef(state.remoteMetadata)

  useEffect(() => {
    remoteMetadataRef.current = state.remoteMetadata
  }, [state.remoteMetadata])

  useEffect(() => {
    let cancelled = false

    async function hydrateApp() {
      try {
        if (!cancelled) {
          dispatch({ type: 'SET_SYNC_STATUS', status: 'syncing' })
        }

        const token = getAccessToken()

        if (token) {
          try {
            await ensureInitialFiles()
            const syncResult = await syncAll()
            const mergedDriveState = syncResultToAppState(syncResult)
            const syncTime = syncResult.latestRemoteModified || new Date().toISOString()

            if (!cancelled) {
              dispatch({
                type: 'HYDRATE_STATE',
                data: {
                  ...mergedDriveState,
                  syncStatus: 'synced',
                  lastSynced: syncTime,
                  hydrated: true,
                  isFromDrive: true,
                },
              })
              localStorage.setItem(LAST_SYNC_KEY, syncTime)
            }
            return
          } catch (driveError) {
            console.warn('Drive sync failed, falling back to local cache:', driveError)
          }
        }

        // Fallback to localStorage only if Drive sync failed or no token
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (raw) {
            const localData = JSON.parse(raw)
            if (!cancelled) {
              dispatch({
                type: 'HYDRATE_STATE',
                data: {
                  ...mergeWithInitialState(localData),
                  syncStatus: navigator.onLine ? 'offline' : 'offline',
                  hydrated: true,
                  isFromDrive: false,
                },
              })
            }
          } else {
            throw new Error('No local data')
          }
        } catch {
          if (!cancelled) {
            dispatch({
              type: 'HYDRATE_STATE',
              data: {
                ...buildSampleState(),
                syncStatus: 'offline',
                hydrated: true,
                isFromDrive: false,
              },
            })
          }
        }
      } catch (error) {
        console.error('Fatal app initialization error:', error)
        if (!cancelled) {
          dispatch({
            type: 'HYDRATE_STATE',
            data: {
              ...buildSampleState(),
              syncStatus: 'offline',
              hydrated: true,
              isFromDrive: false,
            },
          })
        }
      }
    }

    hydrateApp()

    return () => {
      cancelled = true
    }
  }, [])

  // 🔥 FIX 2: Periodic sync every 15 seconds for cross-device updates
  useEffect(() => {
    if (!state.hydrated) return

    const token = getAccessToken()
    if (!token) return

    const performPeriodicSync = async () => {
      try {
        const syncResult = await syncAll()
        if (!hasRemoteStateChanged(syncResult.metadata, remoteMetadataRef.current)) {
          dispatch({
            type: 'SET_SYNC_STATUS',
            status: navigator.onLine ? 'synced' : 'offline',
          })
          return
        }

        const mergedDriveState = syncResultToAppState(syncResult)
        const syncTime = syncResult.latestRemoteModified || new Date().toISOString()

        dispatch({
          type: 'HYDRATE_STATE',
          data: {
            ...mergedDriveState,
            syncStatus: 'synced',
            lastSynced: syncTime,
            hydrated: true,
            isFromDrive: true,
          },
        })
        localStorage.setItem(LAST_SYNC_KEY, syncTime)
      } catch (error) {
        console.error('Periodic sync failed:', error)
      }
    }

    syncIntervalId = setInterval(performPeriodicSync, 15000) // Every 15 seconds

    return () => {
      if (syncIntervalId) clearInterval(syncIntervalId)
    }
  }, [state.hydrated])

  // Auto-save to localStorage (fallback only)
  useEffect(() => {
    if (!state.hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (error) {
      console.error('Failed to save app state to localStorage:', error)
    }
  }, [state])

  const api = useMemo(() => {
    const persistModule = (module, data) => {
      const fileName = MODULE_FILE_MAP[module]
      if (!fileName) return

      dispatch({ type: 'SET_SYNC_STATUS', status: 'syncing' })
      autoSave(fileName, data, 1000)
        .then(result => {
          const syncTime = result?.modifiedTime || new Date().toISOString()
          dispatch({
            type: 'SET_REMOTE_METADATA',
            fileName,
            metadata: {
              id: result?.id || null,
              name: fileName,
              modifiedTime: result?.modifiedTime || null,
            },
            syncStatus: navigator.onLine ? 'synced' : 'offline',
            time: syncTime,
          })
          localStorage.setItem(LAST_SYNC_KEY, syncTime)
        })
        .catch(error => {
          console.error(`Failed scheduling auto-save for ${module}:`, error)
          dispatch({
            type: 'SET_SYNC_STATUS',
            status: navigator.onLine ? 'idle' : 'offline',
          })
        })
    }

    const setModule = (module, data) => {
      dispatch({
        type: 'SET_MODULE',
        module,
        data,
        syncStatus: navigator.onLine ? 'synced' : 'offline',
        time: new Date().toISOString(),
      })
      persistModule(module, data)
    }

    const patchModule = (module, data) => {
      const nextData = {
        ...state[module],
        ...data,
      }

      dispatch({
        type: 'PATCH_MODULE',
        module,
        data,
        syncStatus: navigator.onLine ? 'synced' : 'offline',
        time: new Date().toISOString(),
      })
      persistModule(module, nextData)
    }

    const setSyncStatus = (status, time) =>
      dispatch({ type: 'SET_SYNC_STATUS', status, time })

    const setSettings = (data) => {
      const nextSettings = {
        profile: {
          ...state.settings.profile,
          ...(data.profile || {}),
        },
        preferences: {
          ...state.settings.preferences,
          ...(data.preferences || {}),
        },
      }

      dispatch({
        type: 'SET_SETTINGS',
        data,
        syncStatus: navigator.onLine ? 'synced' : 'offline',
        time: new Date().toISOString(),
      })
      persistModule('settings', nextSettings)
    }

    const resetToSample = async () => {
      const token = getAccessToken()
      dispatch({ type: 'RESET_TO_SAMPLE' })

      try {
        if (token) {
          await deleteAllFiles()
        }
      } catch (error) {
        console.error('Failed to delete from Google Drive:', error)
      }

      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(LAST_SYNC_KEY)
      clearDriveCache()

      if (token) {
        const emptyState = buildClearedState()
        Object.entries(MODULE_FILE_MAP).forEach(([module, fileName]) => {
          autoSave(fileName, emptyState[module], 0)
            .then(result => {
              dispatch({
                type: 'SET_REMOTE_METADATA',
                fileName,
                metadata: {
                  id: result?.id || null,
                  name: fileName,
                  modifiedTime: result?.modifiedTime || null,
                },
                syncStatus: navigator.onLine ? 'synced' : 'offline',
                time: result?.modifiedTime || new Date().toISOString(),
              })
            })
            .catch(error => {
              console.error(`Failed to recreate ${module} after delete all:`, error)
            })
        })
      }
    }

    const refreshFromDrive = async () => {
      try {
        dispatch({ type: 'SET_SYNC_STATUS', status: 'syncing' })
        const token = getAccessToken()
        if (!token) {
          dispatch({ type: 'SET_SYNC_STATUS', status: 'offline' })
          return
        }

        await ensureInitialFiles()
        const syncResult = await syncAll()
        const mergedDriveState = syncResultToAppState(syncResult)
        const syncTime = syncResult.latestRemoteModified || new Date().toISOString()

        dispatch({
          type: 'HYDRATE_STATE',
          data: {
            ...mergedDriveState,
            syncStatus: 'synced',
            lastSynced: syncTime,
            hydrated: true,
            isFromDrive: true,
          },
        })
        localStorage.setItem(LAST_SYNC_KEY, syncTime)
      } catch (error) {
        console.error('Manual refresh failed:', error)
        dispatch({
          type: 'SET_SYNC_STATUS',
          status: navigator.onLine ? 'idle' : 'offline',
        })
      }
    }

    return {
      state,
      setModule,
      patchModule,
      setSyncStatus,
      setSettings,
      resetToSample,
      refreshFromDrive,
    }
  }, [state])

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>
}

export const useApp = () => useContext(AppContext)
