import { useEffect, useState, useCallback } from 'react'
import { Agent } from '@atproto/api'
import { initOAuth, client } from './lib/atproto'

interface MatchResult {
  did: string
  handle: string
  displayName?: string
  avatar?: string
}

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [handle, setHandle] = useState('')
  const [listUri, setListUri] = useState('')
  const [results, setResults] = useState<MatchResult[]>([])
  const [status, setStatus] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const checkSession = useCallback(async () => {
    try {
      const sess = await initOAuth()
      setSession(sess)
    } catch (err) {
      console.error('OAuth init error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  const login = async () => {
    if (!handle) return
    try {
      await client.signIn(handle.startsWith('@') ? handle.substring(1) : handle)
    } catch (err) {
      console.error('Login error:', err)
      alert('Login failed. Please check your handle.')
    }
  }

  const logout = () => {
    setSession(null)
    // Clear session from storage if needed
    localStorage.clear()
    window.location.href = window.location.origin
  }

  const checkList = async () => {
    if (!session || !listUri) return

    setIsProcessing(true)
    setStatus('Fetching your follows...')
    setResults([])
    
    try {
      const agent = new Agent(session)
      
      // 1. Get all follows
      let follows: any[] = []
      let cursor: string | undefined
      do {
        const res: any = await agent.getFollows({ actor: session.did, cursor })
        follows = [...follows, ...res.data.follows]
        cursor = res.data.cursor
      } while (cursor)

      setStatus(`Found ${follows.length} follows. Fetching list members...`)

      // 2. Resolve list URI
      let atUri = listUri.trim()
      if (atUri.startsWith('https://bsky.app/profile/')) {
        const url = new URL(atUri)
        const pathParts = url.pathname.split('/')
        // /profile/did:plc:xxx/lists/3k... or /profile/handle.bsky.social/lists/3k...
        const handleOrDid = pathParts[2]
        const rkey = pathParts[4]
        
        if (handleOrDid && rkey) {
          const resolved = await agent.resolveHandle({ handle: handleOrDid })
          atUri = `at://${resolved.data.did}/app.bsky.graph.list/${rkey}`
        } else {
          throw new Error('Invalid list URL format')
        }
      }

      // 3. Get list members
      let listMembers: string[] = []
      let listCursor: string | undefined
      do {
        const res: any = await agent.app.bsky.graph.getList({ list: atUri, cursor: listCursor })
        listMembers = [...listMembers, ...res.data.items.map((i: any) => i.subject.did)]
        listCursor = res.data.cursor
      } while (listCursor)

      setStatus(`List has ${listMembers.length} members. Comparing...`)

      // 4. Find intersection
      const memberSet = new Set(listMembers)
      const matches = follows
        .filter(f => memberSet.has(f.did))
        .map(f => ({
          did: f.did,
          handle: f.handle,
          displayName: f.displayName,
          avatar: f.avatar
        }))

      setResults(matches)
      setStatus(matches.length > 0 ? `Found ${matches.length} matches!` : 'No matches found.')
    } catch (err) {
      console.error('Check error:', err)
      setStatus('Error: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setIsProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600 font-medium">Initializing session...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.34-3.369-1.34-.454-1.152-1.11-1.458-1.11-1.458-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight">Does My Follows In This List</h1>
          </div>
          {session && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500 hidden sm:inline">@{session.handle}</span>
              <button 
                onClick={logout}
                className="text-sm font-medium text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md transition"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {!session ? (
          <div className="max-w-md mx-auto text-center py-12">
            <h2 className="text-3xl font-extrabold mb-4">Check your follows in lists</h2>
            <p className="text-slate-600 mb-8 text-lg">
              Find out which of your followers are included in a specific moderation or curated list.
            </p>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <label className="block text-sm font-semibold text-slate-700 mb-2 text-left">
                Your Bluesky Handle
              </label>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="e.g., alice.bsky.social"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && login()}
                />
                <button
                  onClick={login}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transform active:scale-[0.98] transition shadow-lg shadow-blue-200"
                >
                  Sign in with Bluesky
                </button>
              </div>
              <p className="mt-4 text-xs text-slate-400">
                Safe OAuth login. We never see your password.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs">1</span>
                Enter List URL
              </h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="https://bsky.app/profile/did:plc:.../lists/..."
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition bg-slate-50"
                  value={listUri}
                  onChange={(e) => setListUri(e.target.value)}
                />
                <button
                  onClick={checkList}
                  disabled={!listUri || isProcessing}
                  className="w-full bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:bg-slate-300 transition flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    'Check My Follows'
                  )}
                </button>
              </div>
              {status && (
                <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium animate-pulse">
                  {status}
                </div>
              )}
            </section>

            {results.length > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-slate-800">
                    Results <span className="text-blue-600 ml-1">{results.length}</span>
                  </h2>
                  <button 
                    onClick={() => {
                      const text = results.map(r => `@${r.handle}`).join('\n')
                      navigator.clipboard.writeText(text)
                      alert('Copied handles to clipboard!')
                    }}
                    className="text-xs font-semibold bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition"
                  >
                    Copy All Handles
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.map((user) => (
                    <div key={user.did} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 hover:shadow-md transition group">
                      <div className="relative">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.handle} className="w-12 h-12 rounded-full object-cover border border-slate-100" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 truncate group-hover:text-blue-600 transition">
                          {user.displayName || user.handle}
                        </h3>
                        <p className="text-sm text-slate-500 truncate">@{user.handle}</p>
                      </div>
                      <a
                        href={`https://bsky.app/profile/${user.handle}`}
                        target="_blank"
                        rel="noreferrer"
                        className="opacity-0 group-hover:opacity-100 p-2 bg-slate-50 text-slate-600 hover:text-blue-600 rounded-full transition"
                        title="View Profile"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {status.includes('No matches found') && results.length === 0 && (
              <div className="bg-white py-12 px-6 rounded-2xl border border-slate-200 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800">Clean!</h3>
                <p className="text-slate-500">None of your follows are in this list.</p>
              </div>
            )}
          </div>
        )}
      </main>
      
      <footer className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-400 text-sm">
        <p>DoesMyFollowsInThisList — Built for Bluesky Moderation</p>
      </footer>
    </div>
  )
}

export default App
