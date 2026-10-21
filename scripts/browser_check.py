"""Real Chromium navigation/input/layout smoke checks. No production cheats.
Requires `pip install playwright` and Chromium (or CHROMIUM_PATH).
Start `npm run dev` first. ESCAPE_URL overrides the default local URL.
"""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'artifacts'
BASE = os.environ.get('ESCAPE_URL', 'http://127.0.0.1:5173')
report = []
errors = []
completed = False
async def state(page): return await page.evaluate('escapeTest.state()')
async def check_layout(page, label):
    problems = await page.evaluate('''() => {
      const app=document.querySelector('#app').getBoundingClientRect();
      return [...document.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width>0).flatMap(e=>{
        const r=e.getBoundingClientRect();
        const clipped=r.left<app.left || r.right>app.right+1 || r.top<app.top || r.bottom>app.bottom+1;
        const c=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return clipped || !e.contains(c) ? [e.id] : [];
      });
    }''')
    assert not problems, (label, problems)
    report.append(f'PASS {label}: controls visible and reachable')

async def desktop(browser):
    page = await browser.new_page(viewport={'width':1280,'height':720})
    page.on('pageerror',lambda e: errors.append(str(e)))
    await page.goto(BASE+'/?test')
    await page.wait_for_selector('#play')
    await check_layout(page,'desktop title')
    await page.screenshot(path=str(OUT/'menu-desktop.png'))
    await page.click('#info'); await check_layout(page,'desktop info'); await page.click('#back')
    await page.click('#music'); assert await page.locator('#music').inner_text() == 'Music off'
    await page.click('#sfx'); assert await page.locator('#sfx').inner_text() == 'Sound off'
    await page.reload(); await page.wait_for_selector('#play')
    assert await page.locator('#music').inner_text() == 'Music off'
    assert await page.locator('#sfx').inner_text() == 'Sound off'
    report.append('PASS independent audio preferences persist across reload')
    angles = {}
    for mode in ['Easy','Medium','Hard']:
        for session in range(2):
            await page.click('#play')
            await check_layout(page,f'{mode} selection')
            await page.click('#choose-'+mode)
            await page.wait_for_timeout(120)
            s=await state(page)
            assert s['mode']==mode and s['time']<1 and s['coins']==0 and not s['effects']
            if mode in angles: assert abs(s['angle']-angles[mode])>.1
            angles[mode]=s['angle']
            old=s['ship']
            await page.keyboard.down('ArrowRight');await page.wait_for_timeout(220);await page.keyboard.up('ArrowRight')
            s=await state(page);assert s['ship']['x']>old['x']+10, (mode,s,old)
            # Exercise scheduled first shot and volley in the actual RAF loop.
            target={'Easy':1,'Medium':3,'Hard':5}[mode]
            await page.wait_for_function('(n)=>escapeTest.state().shots>=n || escapeTest.state().dead',arg=target,timeout=25000)
            s=await state(page)
            # A real random death is allowed in a gameplay session; modifier and
            # exact volley scheduling are independently asserted by unit tests.
            if not s['dead']:
                assert s['shots']==target and s['time']<=2.1, (mode,s)
                assert not s['openingVolley']
                report.append(f"PASS {mode} opening: {target} shots by {s['time']:.3f}s, normal phase restored")
                # A ball can legitimately hit between observing the volley and
                # pausing. Use the keyboard path and inspect the actual screen.
                await page.keyboard.press('p')
            if (await state(page))['screen']=='pause':
                before=await state(page)
                await page.wait_for_timeout(300);after=await state(page)
                assert after['time']==before['time'] and after['ship']==before['ship']
                await check_layout(page,mode+' pause')
                await page.click('#resume')
                if mode=='Easy' and session==0:
                    await page.evaluate('escapeTest.debug()')
                    await page.screenshot(path=str(OUT/'collision-debug.png'))
                    await page.evaluate('escapeTest.debug()')
                    # All eight effects, each through the running game render/audio path.
                    for effect in ['small','double','clear','fast','large','ballsFast','noCoins','slow']:
                        await page.evaluate('(id)=>escapeTest.apply(id)',effect)
                        await page.wait_for_timeout(60)
                        if effect!='clear':assert effect in (await state(page))['effects']
                        assert (await page.evaluate('escapeTest.collision()'))['shipSafe']
                    await page.screenshot(path=str(OUT/'gameplay-effects.png'))
                    await page.evaluate('escapeTest.expire()')
                    await page.wait_for_function('Object.keys(escapeTest.state().effects).length===0')
                    assert (await state(page))['size']==1
                    await page.wait_for_timeout(800)
                    await page.screenshot(path=str(OUT/'gameplay-desktop.png'))
                await page.evaluate('escapeTest.fatal()')
            await page.wait_for_selector('#retry',timeout=10000)
            assert (await state(page))['screen']=='results'
            assert await page.evaluate('(mode)=>Number(localStorage.getItem("escape.best."+mode))>=escapeTest.state().score',mode)
            await check_layout(page,f'{mode} results')
            frozen=(await state(page))['time']
            await page.wait_for_timeout(150);assert (await state(page))['time']==frozen
            if mode=='Hard':await page.screenshot(path=str(OUT/'results-desktop.png'))
            await page.click('#retry');s=await state(page)
            assert s['time']<.5 and s['coins']==0 and not s['effects'] and s['balls']==0
            await page.click('#pause');await page.click('#home')
            report.append(f'PASS {mode} session {session+1}: movement, firing, death/results, retry reset')
    await page.close()

async def mobile(browser):
    ctx=await browser.new_context(viewport={'width':844,'height':390},device_scale_factor=2,is_mobile=True,has_touch=True)
    await ctx.add_init_script('''let escapeSeed=54321; Math.random=()=>{escapeSeed=(Math.imul(escapeSeed,1664525)+1013904223)>>>0;return escapeSeed/4294967296};''')
    page=await ctx.new_page();page.on('pageerror',lambda e: errors.append(str(e)))
    page.set_default_timeout(10000)
    await page.goto(BASE+'/?test');await page.wait_for_selector('#play')
    await check_layout(page,'phone title')
    await page.click('#info');await check_layout(page,'phone info');await page.click('#back')
    await page.click('#play');await check_layout(page,'phone difficulty');await page.click('#choose-Easy')
    await page.wait_for_timeout(100)
    # Use actual touch events through Chromium's input protocol, including capture.
    box=await page.locator('#joystick').bounding_box();assert box
    x,y=box['x']+box['width']/2,box['y']+box['height']/2
    before=(await state(page))['ship']
    cdp=await ctx.new_cdp_session(page)
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+box['width']*.35,'y':y}]})
    await page.wait_for_timeout(400)
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    after=(await state(page))['ship'];assert after['x']>before['x']+20,(before,after)
    await check_layout(page,'phone gameplay')
    await page.wait_for_timeout(1400)
    await page.screenshot(path=str(OUT/'gameplay-phone-landscape.png'))
    if (await state(page))['dead']:
        await page.wait_for_selector('#retry');await page.tap('#retry')
    await page.tap('#pause');assert (await state(page))['screen']=='pause'
    await check_layout(page,'phone pause');await page.tap('#resume')
    await page.set_viewport_size({'width':390,'height':844});await page.wait_for_timeout(150)
    assert await page.locator('#rotate').is_visible();assert (await state(page))['screen']=='pause'
    await page.screenshot(path=str(OUT/'phone-portrait-prompt.png'))
    await page.set_viewport_size({'width':844,'height':390});await page.tap('#resume')
    assert (await page.evaluate('escapeTest.collision()'))['ballsSafe']
    await page.evaluate('escapeTest.fatal()');await page.wait_for_selector('#retry')
    await check_layout(page,'phone results');await page.tap('#levels');await check_layout(page,'phone change difficulty')
    # Smaller and wider landscape layouts, with navigation on each.
    for w,h in [(667,375),(568,320),(932,430)]:
        await page.set_viewport_size({'width':w,'height':h});await check_layout(page,f'{w}x{h} difficulty')
        await page.tap('#back');await check_layout(page,f'{w}x{h} title')
        await page.tap('#info');await check_layout(page,f'{w}x{h} info')
        await page.tap('#back');await page.tap('#play');await page.tap('#choose-Medium')
        await page.tap('#pause');await check_layout(page,f'{w}x{h} pause')
        await page.tap('#resume');await page.evaluate('escapeTest.fatal()');await page.wait_for_selector('#retry')
        await check_layout(page,f'{w}x{h} results');await page.tap('#levels')
    report.append('PASS actual touch steering, portrait auto-pause, landscape return, collision alignment')
    await ctx.close()

async def main():
    global completed
    OUT.mkdir(exist_ok=True)
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
        try:
            if not os.environ.get('MOBILE_ONLY'): await desktop(browser)
            await mobile(browser)
            assert not errors,errors
            report.append('PASS no browser runtime errors')
            completed = True
        finally:
            (OUT/'browser-report.json').write_text(json.dumps({'completed':completed,'checks':report,'runtimeErrors':errors},indent=2))
            print('\n'.join(report),flush=True)
            await browser.close()
asyncio.run(main())
