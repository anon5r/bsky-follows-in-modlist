import { useEffect, useState, useCallback } from 'react'
import { Agent } from '@atproto/api'
import { initOAuth, client } from './lib/atproto'

interface UserView {
  did: string
  handle: string
  displayName?: string
  avatar?: string
}

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [handle, setHandle] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [profile, setProfile] = useState<{ handle: string, avatar?: string } | null>(null)

  // Step 1: My Follows
  const [myFollows, setMyFollows] = useState<UserView[]>([])
  const [followsCount, setFollowsCount] = useState<number | null>(null)
  const [followsLoading, setFollowsLoading] = useState(false)
  const [followsError, setFollowsError] = useState('')

  // Step 2: List Members
  const [listUri, setListUri] = useState('')
  const [listMembersDid, setListMembersDid] = useState<Set<string>>(new Set())
  const [listCount, setListCount] = useState<number | null>(null)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')

  // Step 3: Results
  const [results, setResults] = useState<UserView[]>([])
  const [hasChecked, setHasChecked] = useState(false)

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

  useEffect(() => {
    if (session) {
      const agent = new Agent(session)
      agent.getProfile({ actor: session.did })
        .then(res => {
          setProfile({
            handle: res.data.handle,
            avatar: res.data.avatar
          })
        })
        .catch(err => console.error('Profile fetch error:', err))
    } else {
      setProfile(null)
    }
  }, [session])

  const login = async () => {
    if (!handle || loginLoading) return
    setLoginLoading(true)
    try {
      await client.signIn(handle.startsWith('@') ? handle.substring(1) : handle)
    } catch (err) {
      console.error('Login error:', err)
      alert('Login failed. Please check your handle.')
      setLoginLoading(false)
    }
  }

  const logout = () => {
    setSession(null)
    localStorage.clear()
    window.location.href = window.location.origin
  }

  // --- Actions ---

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const fetchMyFollows = async () => {
    if (!session) return
    setFollowsLoading(true)
    setFollowsError('')
    setMyFollows([])
    setFollowsCount(0)
    setHasChecked(false)
    
    try {
      const agent = new Agent(session)
      let allFollows: UserView[] = []
      let cursor: string | undefined
      
      do {
        const res: any = await agent.getFollows({ actor: session.did, cursor, limit: 100 })
        const page = res.data.follows.map((f: any) => ({
          did: f.did,
          handle: f.handle,
          displayName: f.displayName,
          avatar: f.avatar
        }))
        allFollows = [...allFollows, ...page]
        cursor = res.data.cursor
        
        // Update progress
        setFollowsCount(allFollows.length)
        // Small delay to be nice to the API
        await delay(50)
      } while (cursor)

      setMyFollows(allFollows)
    } catch (err) {
      console.error(err)
      setFollowsError(err instanceof Error ? err.message : String(err))
    } finally {
      setFollowsLoading(false)
    }
  }

  const fetchListMembers = async () => {
    if (!session || !listUri) return
    setListLoading(true)
    setListError('')
    setListMembersDid(new Set())
    setListCount(0)
    setHasChecked(false)
    setResults([])

    try {
      const agent = new Agent(session)
      
      // Resolve URI
      let atUri = listUri.trim()
      if (atUri.startsWith('https://bsky.app/')) {
        const url = new URL(atUri)
        const pathParts = url.pathname.split('/')
        // Expected format: /profile/{handleOrDid}/lists/{rkey}
        const handleOrDid = pathParts[2]
        const rkey = pathParts[4]
        
        if (handleOrDid && rkey) {
          let did = handleOrDid
          if (!handleOrDid.startsWith('did:')) {
            const resolved = await agent.resolveHandle({ handle: handleOrDid })
            did = resolved.data.did
          }
          atUri = `at://${did}/app.bsky.graph.list/${rkey}`
        } else {
          throw new Error('Invalid list URL format')
        }
      } else if (!atUri.startsWith('at://')) {
        throw new Error('Please enter a valid Bluesky list URL or AT-URI')
      }

      // Fetch Members
      let members = new Set<string>()
      let cursor: string | undefined
      do {
        const res: any = await agent.app.bsky.graph.getList({ list: atUri, cursor, limit: 100 })
        res.data.items.forEach((i: any) => members.add(i.subject.did))
        cursor = res.data.cursor
        
        // Update progress
        setListCount(members.size)
        // Small delay
        await delay(50)
      } while (cursor)

      setListMembersDid(members)
    } catch (err) {
      console.error(err)
      setListError(err instanceof Error ? err.message : String(err))
    } finally {
      setListLoading(false)
    }
  }

  const compareLists = () => {
    if (myFollows.length === 0 || listMembersDid.size === 0) return
    const matches = myFollows.filter(user => listMembersDid.has(user.did))
    setResults(matches)
    setHasChecked(true)
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
            <h1 className="text-xl font-bold tracking-tight text-blue-700">Save Your Follows</h1>
          </div>
          {session && (
            <div className="flex items-center gap-3">
              {profile ? (
                <>
                  <div className="flex items-center gap-2 mr-2">
                    {profile.avatar ? (
                      <img src={profile.avatar} className="w-8 h-8 rounded-full border border-slate-200 object-cover" alt={profile.handle} />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-200" />
                    )}
                    <span className="text-sm text-slate-700 font-medium hidden sm:inline">@{profile.handle}</span>
                  </div>
                </>
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse mr-2" />
              )}
              <button onClick={logout} className="text-sm font-medium text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md transition">
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
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-8">
              <input
                type="text"
                placeholder="e.g., alice.bsky.social"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-blue-500"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && login()}
                disabled={loginLoading}
              />
              <button
                onClick={login}
                disabled={loginLoading || !handle}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:bg-slate-300 transition flex items-center justify-center gap-2"
              >
                {loginLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Redirecting...
                  </>
                ) : (
                  'Sign in with Bluesky'
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Step 1 */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs">1</span>
                Get Your Follows
              </h2>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <button
                  onClick={fetchMyFollows}
                  disabled={followsLoading}
                  className="w-full sm:w-auto bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-slate-800 disabled:bg-slate-300 transition"
                >
                  {followsLoading ? 'Fetching...' : 'Fetch My Follows'}
                </button>
                <div className="flex-1 text-right sm:text-left">
                  {followsLoading && <span className="text-blue-600 animate-pulse">Fetching...</span>}
                  {!followsLoading && followsCount !== null && (
                    <span className="text-green-600 font-medium">Successfully fetched {followsCount} accounts.</span>
                  )}
                  {followsError && <span className="text-red-600 text-sm">{followsError}</span>}
                </div>
              </div>
            </section>

            {/* Step 2 */}
            <section className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 ${followsCount === null ? 'opacity-50 pointer-events-none' : ''}`}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs">2</span>
                Get List Members
              </h2>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://bsky.app/profile/.../lists/..."
                    className="flex-1 border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                    value={listUri}
                    onChange={(e) => setListUri(e.target.value)}
                  />
                  <button
                    onClick={fetchListMembers}
                    disabled={listLoading || !listUri}
                    className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-slate-800 disabled:bg-slate-300 transition whitespace-nowrap"
                  >
                    {listLoading ? 'Fetching...' : 'Fetch List'}
                  </button>
                </div>
                <div>
                  {listLoading && <span className="text-blue-600 animate-pulse">Fetching list members...</span>}
                  {!listLoading && listCount !== null && (
                    <span className="text-green-600 font-medium">Successfully fetched {listCount} members from list.</span>
                  )}
                  {listError && <span className="text-red-600 text-sm">{listError}</span>}
                </div>
              </div>
            </section>

            {/* Step 3 */}
            <section className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 ${listCount === null || listLoading ? 'opacity-50 pointer-events-none' : ''}`}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs">3</span>
                Compare & View Results
              </h2>
              
              <div className="mb-6">
                <button
                  onClick={compareLists}
                  disabled={listCount === null || listLoading}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition disabled:bg-slate-300 disabled:shadow-none active:scale-[0.98]"
                >
                  Check for Matches
                </button>
              </div>

              {hasChecked && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                    <h3 className="text-lg font-bold text-slate-800">
                      Matches Found: <span className="text-blue-600">{results.length}</span>
                    </h3>
                  </div>

                  {results.length === 0 ? (
                     <p className="text-slate-500 italic">No matches found. None of your follows are in this list.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="text-xs text-slate-500 border-b border-slate-200">
                            <th className="py-2 pl-2">User</th>
                            <th className="py-2">Handle</th>
                            <th className="py-2">DID</th>
                            <th className="py-2 pr-2">Link</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {results.map((user) => (
                            <tr key={user.did} className="border-b border-slate-100 hover:bg-slate-50 transition">
                              <td className="py-3 pl-2 flex items-center gap-3">
                                {user.avatar ? (
                                  <img src={user.avatar} className="w-8 h-8 rounded-full bg-slate-200" alt="" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-200" />
                                )}
                                <span className="font-medium text-slate-900 truncate max-w-[150px]">{user.displayName || user.handle}</span>
                              </td>
                              <td className="py-3 text-slate-600">{user.handle}</td>
                              <td className="py-3 text-slate-400 font-mono text-xs select-all">{user.did}</td>
                              <td className="py-3 pr-2 text-right">
                                <a
                                  href={`https://bsky.app/profile/${user.handle}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline text-xs"
                                >
                                  View
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default App