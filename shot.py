import sys, asyncio, json
from playwright.async_api import async_playwright
steps = json.loads(sys.argv[1]) if len(sys.argv)>1 else []
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'])
        import os
        mob=os.environ.get('MOB')
        cx = await b.new_context(viewport=({'width':390,'height':844} if mob=='P' else {'width':844,'height':390}),has_touch=True,is_mobile=True,device_scale_factor=1) if mob else await b.new_context(viewport={'width':960,'height':540})
        pg = await cx.new_page()
        logs=[]
        pg.on('console', lambda m: logs.append(m.type+': '+m.text))
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: '+str(e)))
        await pg.goto('file:///home/claude/ile/test.html', timeout=240000)
        await pg.wait_for_timeout(9000)
        for name, js, wait in steps:
            if js: 
                try: r = await pg.evaluate(js); 
                except Exception as e: logs.append('EVALERR '+str(e)[:300]); r=None
                if r is not None: print(name, '=>', r)
            await pg.wait_for_timeout(wait)
            if name and not name.startswith('_'):
                try: await pg.screenshot(path=f'/tmp/{name}.png', timeout=120000)
                except Exception as e: logs.append('SHOTERR '+name)
        print("\n".join(l[:400] for l in logs if "ReadPixels" not in l)[:3000])
        await b.close()
asyncio.run(main())
