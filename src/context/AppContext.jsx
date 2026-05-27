import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
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
import { syncAll, autoSave, ensureInitialFiles } from '../services/driveService'
import { getAccessToken } from '../services/authService'
const STORAGE_KEY = 'lifeos-app-state-v1'

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
  hydrated: false,
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
    hydrated: true,
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
      return buildSampleState()

    default:
      return state
  }
}

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    let cancelled = false

    async function hydrateApp() {
      let localData = null

      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          localData = JSON.parse(raw)
          if (!cancelled) {
            dispatch({
              type: 'HYDRATE_STATE',
              data: {
                ...mergeWithInitialState(localData),
                syncStatus: 'idle',
                hydrated: true,
              },
            })
          }
        } else if (!cancelled) {
          dispatch({
            type: 'HYDRATE_STATE',
            data: {
              ...buildSampleState(),
              syncStatus: 'idle',
              hydrated: true,
            },
          })
        }
      } catch (error) {
        console.error('Failed to load local app state:', error)
        if (!cancelled) {
          dispatch({
            type: 'HYDRATE_STATE',
            data: {
              ...buildSampleState(),
              syncStatus: 'idle',
              hydrated: true,
            },
          })
        }
      }

      try {
        if (!cancelled) {
          dispatch({ type: 'SET_SYNC_STATUS', status: 'syncing' })
        }
        const token = getAccessToken()

        if (!token) {
          if (!cancelled) {
            dispatch({
              type: 'SET_SYNC_STATUS',
              status: 'offline',
            })
          }
          return
        }
        await ensureInitialFiles()
        const files = await syncAll()
        const mergedDriveState = driveDataToAppState(files)

        if (!cancelled) {
          dispatch({
            type: 'HYDRATE_STATE',
            data: {
              ...mergedDriveState,
              syncStatus: 'synced',
              lastSynced: new Date().toISOString(),
              hydrated: true,
            },
          })
        }
      } catch (error) {
        console.error('Failed to sync with Drive, using local cache:', error)
        if (!cancelled) {
          dispatch({
            type: 'SET_SYNC_STATUS',
            status: navigator.onLine ? 'idle' : 'offline',
          })
        }
      }
    }

    hydrateApp()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!state.hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (error) {
      console.error('Failed to save app state:', error)
    }
  }, [state])

  const api = useMemo(() => {
    const persistModule = (module, data) => {
      const fileName = MODULE_FILE_MAP[module]
      if (!fileName) return

      dispatch({ type: 'SET_SYNC_STATUS', status: 'syncing' })

      try {
        autoSave(fileName, data, 2000)
        dispatch({
          type: 'SET_SYNC_STATUS',
          status: navigator.onLine ? 'synced' : 'offline',
          time: new Date().toISOString(),
        })
      } catch (error) {
        console.error(`Failed scheduling auto-save for ${module}:`, error)
        dispatch({
          type: 'SET_SYNC_STATUS',
          status: navigator.onLine ? 'idle' : 'offline',
        })
      }
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

    const resetToSample = () => {
      const sample = buildSampleState()
      dispatch({ type: 'RESET_TO_SAMPLE' })

      persistModule('finance', sample.finance)
      persistModule('timeflow', sample.timeflow)
      persistModule('study', sample.study)
      persistModule('habits', sample.habits)
      persistModule('health', sample.health)
      persistModule('journal', sample.journal)
      persistModule('settings', sample.settings)
    }

    return {
      state,
      setModule,
      patchModule,
      setSyncStatus,
      setSettings,
      resetToSample,
    }
  }, [state])

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>
}

export const useApp = () => useContext(AppContext)