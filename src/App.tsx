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
  
  // Language Support
  const [lang, setLang] = useState<'en' | 'ja'>('en')
  
  // Option: Include Followers
  const [includeFollowers, setIncludeFollowers] = useState(false)

  // Login History
  const [loginHistory, setLoginHistory] = useState<string[]>([])

  useEffect(() => {
    const browserLang = navigator.language.startsWith('ja') ? 'ja' : 'en'
    setLang(browserLang)

    // Load login history
    const history = localStorage.getItem('login_history')
    if (history) {
      setLoginHistory(JSON.parse(history))
    }
  }, [])

  const toggleLang = () => setLang(prev => prev === 'en' ? 'ja' : 'en')

  const text = {
    en: {
      title: "Check your follows in lists",
      subtitle: "Find out which of your follows are included in a specific moderation or curated list.",
      handleLabel: "Your Bluesky Handle",
      placeholder: "e.g., alice.bsky.social",
      signIn: "Sign in with Bluesky",
      redirecting: "Redirecting...",
      safeLogin: "Safe OAuth login. We never see your password.",
      aboutTitle: "About this app",
      aboutDesc1: "This tool allows you to check if any users you follow are included in a specific Bluesky list (Moderation List or Curated List).",
      aboutDesc2: "Useful for checking if your friends are included in block lists or specific community lists.",
      howToUse: "How to use",
      step1: "Sign in with your Bluesky account (OAuth).",
      step2: "Fetch your follow list.",
      step3: "Enter the URL of the list you want to check and fetch its members.",
      step4: "Compare and see the results.",
      privacy: "Privacy: All processing happens in your browser. We do not store your data.",
      includeFollowers: "Also check my followers",
      fetchButton: "Fetch My Follows",
      fetching: "Fetching...",
      successFollows: "follows",
      successFollowers: "followers",
      tabFollows: "Matches in Follows",
      tabFollowers: "Matches in Followers",
      noMatches: "No matches found.",
      copyHandles: "Copy Handles",
      clean: "Clean! None found in this list.",
      loginHistory: "Recent logins",
      prTitle: "Chronosky: Bluesky Post Scheduler",
      prDesc: "Schedule your posts for the perfect time.",
    },
    ja: {
      title: "リストに含まれるフォローをチェック",
      subtitle: "あなたのフォローしているユーザーが、特定のモデレーションリストやキュレーションリストに含まれているかを確認できます。",
      handleLabel: "Blueskyハンドル",
      placeholder: "例: alice.bsky.social",
      signIn: "Blueskyでサインイン",
      redirecting: "リダイレクト中...",
      safeLogin: "安全なOAuthログインです。パスワードは送信されません。",
      aboutTitle: "このアプリについて",
      aboutDesc1: "このツールを使用すると、あなたがフォローしているユーザーが、指定したBlueskyリスト（モデレーションリストやユーザーリスト）に含まれているかどうかを確認できます。",
      aboutDesc2: "友人がブロックリストに含まれていないか確認したり、特定のコミュニティリストに入っているフォローを探すのに便利です。",
      howToUse: "使い方",
      step1: "Blueskyアカウントでサインインします（OAuth認証）。",
      step2: "あなたのフォロー一覧を取得します。",
      step3: "チェックしたいリストのURLを入力し、メンバーを取得します。",
      step4: "比較を実行し、結果を表示します。",
      privacy: "プライバシー: すべての処理はお使いのブラウザ内で行われます。データをサーバーに保存することはありません。",
      includeFollowers: "フォロワーもチェックする",
      fetchButton: "フォロー情報を取得",
      fetching: "取得中...",
      successFollows: "件のフォロー",
      successFollowers: "件のフォロワー",
      tabFollows: "フォロー内の一致",
      tabFollowers: "フォロワー内の一致",
      noMatches: "一致なし",
      copyHandles: "ハンドルをコピー",
      clean: "リストに含まれるユーザーはいませんでした。",
      loginHistory: "最近のログイン",
      prTitle: "Chronosky: Bluesky予約投稿サービス",
      prDesc: "最適な時間に投稿を予約できます。",
    }
  }

  // Step 1: My Follows & Followers
  const [myFollows, setMyFollows] = useState<UserView[]>([])
  const [myFollowers, setMyFollowers] = useState<UserView[]>([])
  const [followsCount, setFollowsCount] = useState<number | null>(null)
  const [followersCount, setFollowersCount] = useState<number | null>(null)
  const [followsLoading, setFollowsLoading] = useState(false)
  const [followsError, setFollowsError] = useState('')

  // Step 2: List Members
  const [listUri, setListUri] = useState('')
  const [listMembersDid, setListMembersDid] = useState<Set<string>>(new Set())
  const [listCount, setListCount] = useState<number | null>(null)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [listMeta, setListMeta] = useState<{
    name: string;
    description?: string;
    avatar?: string;
    creator: { handle: string; displayName?: string; avatar?: string };
  } | null>(null)

  // Step 3: Results
  const [results, setResults] = useState<UserView[]>([])
  const [resultsFollowers, setResultsFollowers] = useState<UserView[]>([])
  const [hasChecked, setHasChecked] = useState(false)
  const [activeTab, setActiveTab] = useState<'follows' | 'followers'>('follows')

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
    let cleanHandle = handle.trim().startsWith('@') ? handle.trim().substring(1) : handle.trim()
    if (!cleanHandle || loginLoading) return
    setLoginLoading(true)
    try {
      await client.signIn(cleanHandle)
      
      // Save to history on successful initiation (best effort as it redirects)
      const newHistory = [cleanHandle, ...loginHistory.filter(h => h !== cleanHandle)].slice(0, 5)
      localStorage.setItem('login_history', JSON.stringify(newHistory))
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
    setMyFollowers([])
    setFollowsCount(0)
    setFollowersCount(null)
    setHasChecked(false)
    
    try {
      const agent = new Agent(session)
      
      // Fetch Follows
      let allFollows: UserView[] = []
      let cursor: string | undefined
      
      // We will fetch follows first
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
        setFollowsCount(allFollows.length)
        await delay(20)
      } while (cursor)
      setMyFollows(allFollows)

      // Fetch Followers if requested
      if (includeFollowers) {
        setFollowersCount(0)
        let allFollowers: UserView[] = []
        let fCursor: string | undefined
        do {
          const res: any = await agent.getFollowers({ actor: session.did, cursor: fCursor, limit: 100 })
          const page = res.data.followers.map((f: any) => ({
            did: f.did,
            handle: f.handle,
            displayName: f.displayName,
            avatar: f.avatar
          }))
          allFollowers = [...allFollowers, ...page]
          fCursor = res.data.cursor
          setFollowersCount(allFollowers.length)
          await delay(20)
        } while (fCursor)
        setMyFollowers(allFollowers)
      }

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
    setListMeta(null)
    setHasChecked(false)
    setResults([])
    setResultsFollowers([])

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
      let isFirstPage = true

      do {
        const res: any = await agent.app.bsky.graph.getList({ list: atUri, cursor, limit: 100 })
        
        if (isFirstPage && res.data.list) {
          setListMeta({
            name: res.data.list.name,
            description: res.data.list.description,
            avatar: res.data.list.avatar,
            creator: {
              handle: res.data.list.creator.handle,
              displayName: res.data.list.creator.displayName,
              avatar: res.data.list.creator.avatar,
            }
          })
          isFirstPage = false
        }

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
    if (listMembersDid.size === 0) return
    
    // Compare Follows
    if (myFollows.length > 0) {
      const matches = myFollows.filter(user => listMembersDid.has(user.did))
      setResults(matches)
    }

    // Compare Followers
    if (myFollowers.length > 0) {
      const matches = myFollowers.filter(user => listMembersDid.has(user.did))
      setResultsFollowers(matches)
    }

    setHasChecked(true)
    setActiveTab('follows')
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
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleLang}
              className="text-sm font-medium text-slate-500 hover:text-blue-600 transition flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
              {lang === 'en' ? '日本語' : 'English'}
            </button>
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
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {!session ? (
          <div className="max-w-md mx-auto py-12">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-extrabold mb-4 text-slate-900">{text[lang].title}</h2>
              <p className="text-slate-600 text-lg">
                {text[lang].subtitle}
              </p>
              
              <div className="bg-white p-6 rounded-2xl shadow-xl shadow-blue-50 border border-slate-200 mt-8 text-left">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  {text[lang].handleLabel}
                </label>
                <input
                  type="text"
                  placeholder={text[lang].placeholder}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-blue-500 transition"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && login()}
                  disabled={loginLoading}
                />
                <button
                  onClick={login}
                  disabled={loginLoading || !handle}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:bg-slate-300 transition flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                >
                  {loginLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      {text[lang].redirecting}
                    </>
                  ) : (
                    text[lang].signIn
                  )}
                </button>
                <p className="mt-4 text-xs text-slate-400 text-center">
                  {text[lang].safeLogin}
                </p>

                {loginHistory.length > 0 && (
                  <div className="mt-6 border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">{text[lang].loginHistory}</p>
                    <div className="flex flex-wrap gap-2">
                      {loginHistory.map(h => (
                        <button
                          key={h}
                          onClick={() => setHandle(h)}
                          className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200 transition"
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-12">
              <h3 className="text-xl font-bold text-slate-800 mb-4">{text[lang].aboutTitle}</h3>
              <p className="text-slate-600 mb-4 leading-relaxed">
                {text[lang].aboutDesc1}
              </p>
              <p className="text-slate-600 mb-8 leading-relaxed">
                {text[lang].aboutDesc2}
              </p>
              
              <h4 className="font-bold text-slate-800 mb-3">{text[lang].howToUse}</h4>
              <ol className="list-decimal list-inside space-y-2 text-slate-600 mb-8 ml-1">
                <li>{text[lang].step1}</li>
                <li>{text[lang].step2}</li>
                <li>{text[lang].step3}</li>
                <li>{text[lang].step4}</li>
              </ol>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm text-slate-500">
                {text[lang].privacy}
              </div>

              {/* PR Section */}
              <div className="mt-12 p-6 rounded-2xl border-2 border-dashed border-blue-100 bg-blue-50/30">
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">PR</span>
                  <h4 className="font-bold text-slate-800">{text[lang].prTitle}</h4>
                </div>
                <p className="text-sm text-slate-600 mb-4">{text[lang].prDesc}</p>
                <a 
                  href="https://chronosky.app" 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 font-bold hover:underline"
                >
                  chronosky.app
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
              </div>
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
              <div className="flex flex-col gap-4">
                <label className="flex items-center gap-2 cursor-pointer w-fit">
                  <input 
                    type="checkbox" 
                    checked={includeFollowers} 
                    onChange={(e) => setIncludeFollowers(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    disabled={followsLoading || myFollows.length > 0}
                  />
                  <span className="text-sm text-slate-700">{text[lang].includeFollowers}</span>
                </label>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <button
                    onClick={fetchMyFollows}
                    disabled={followsLoading}
                    className="w-full sm:w-auto bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-slate-800 disabled:bg-slate-300 transition"
                  >
                    {followsLoading ? text[lang].fetching : text[lang].fetchButton}
                  </button>
                  <div className="flex-1 text-right sm:text-left text-sm">
                    {followsLoading && <span className="text-blue-600 animate-pulse">{text[lang].fetching}</span>}
                    
                    {!followsLoading && followsCount !== null && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <span className="text-green-600 font-medium">✓ {followsCount} {text[lang].successFollows}</span>
                        {followersCount !== null && (
                          <span className="text-green-600 font-medium">✓ {followersCount} {text[lang].successFollowers}</span>
                        )}
                      </div>
                    )}
                    {followsError && <span className="text-red-600">{followsError}</span>}
                  </div>
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
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="https://bsky.app/profile/.../lists/..."
                    className="flex-1 border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 min-w-0"
                    value={listUri}
                    onChange={(e) => setListUri(e.target.value)}
                  />
                  <button
                    onClick={fetchListMembers}
                    disabled={listLoading || !listUri}
                    className="w-full sm:w-auto bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-slate-800 disabled:bg-slate-300 transition whitespace-nowrap"
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

                {listMeta && (
                  <div className="mt-4 p-4 border border-slate-200 rounded-xl bg-slate-50 flex gap-4 items-start">
                    {listMeta.avatar ? (
                      <img src={listMeta.avatar} alt={listMeta.name} className="w-16 h-16 rounded-lg object-cover shadow-sm bg-white" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-blue-100 flex items-center justify-center text-blue-300">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-slate-900 leading-tight">{listMeta.name}</h3>
                      <div className="flex items-center gap-2 mt-1 mb-2">
                        {listMeta.creator.avatar ? (
                          <img src={listMeta.creator.avatar} alt="" className="w-5 h-5 rounded-full" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-slate-200" />
                        )}
                        <p className="text-xs text-slate-500">
                          by <span className="font-medium text-slate-700">{listMeta.creator.displayName || listMeta.creator.handle}</span>
                          <span className="text-slate-400 ml-1">(@{listMeta.creator.handle})</span>
                        </p>
                      </div>
                      {listMeta.description && (
                        <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{listMeta.description}</p>
                      )}
                    </div>
                  </div>
                )}
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

                                {/* Tabs */}

                                {myFollowers.length > 0 ? (

                                  <div className="flex border-b border-slate-200 mb-4">

                                    <button

                                      onClick={() => setActiveTab('follows')}

                                      className={`px-4 py-2 font-bold text-sm transition ${activeTab === 'follows' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}

                                    >

                                      {text[lang].tabFollows} <span className="ml-1 bg-slate-100 px-2 py-0.5 rounded-full text-xs">{results.length}</span>

                                    </button>

                                    <button

                                      onClick={() => setActiveTab('followers')}

                                      className={`px-4 py-2 font-bold text-sm transition ${activeTab === 'followers' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}

                                    >

                                      {text[lang].tabFollowers} <span className="ml-1 bg-slate-100 px-2 py-0.5 rounded-full text-xs">{resultsFollowers.length}</span>

                                    </button>

                                  </div>

                                ) : (

                                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">

                                    <h3 className="text-lg font-bold text-slate-800">

                                      Matches Found: <span className="text-blue-600">{results.length}</span>

                                    </h3>

                                  </div>

                                )}

              

                                {/* Results List */}

                                {(activeTab === 'follows' ? results : resultsFollowers).length === 0 ? (

                                   <div className="py-8 text-center text-slate-500 italic">

                                     {text[lang].clean}

                                   </div>

                                ) : (

                                  <>

                                    <div className="mb-2 text-right">

                                       <button 

                                          onClick={() => {

                                            const list = activeTab === 'follows' ? results : resultsFollowers

                                            const str = list.map(r => `@${r.handle}`).join('\n')

                                            navigator.clipboard.writeText(str)

                                            alert(text[lang].copyHandles)

                                          }}

                                          className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg transition"

                                        >

                                          {text[lang].copyHandles}

                                        </button>

                                    </div>

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

                                          {(activeTab === 'follows' ? results : resultsFollowers).map((user) => (

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

                                  </>

                                )}

                              </div>

                            )}

              
            </section>
          </div>
        )}
      </main>
      
      <footer className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-400 text-sm">
        <p>Save Your Follows — Built for Bluesky Moderation</p>
        <p>Created by <a href="//bsky.app/profile/anon5r.com">@anon5r.com</a></p>
      </footer>
    </div>
  )
}

export default App
