import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';

test('alternative evidence changes capacity and survives saved history',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Document intake'}).click();
  await page.getByRole('button',{name:'Try Aina’s alternative-data story'}).click();
  await expect(page.getByText('9 unique documents',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Reveal local values'}).click();
  await page.getByRole('button',{name:'Confirm 18 reference matches after review'}).click();
  await page.getByRole('button',{name:'Confirm displayed schedule after review'}).click();
  for(const checkbox of await page.locator('.doc-confirm input').all()) await checkbox.check();
  await page.getByRole('button',{name:'Compare evidence impact'}).click();
  await expect(page.getByRole('heading',{name:'Same applicant. A clearer picture.'})).toBeVisible();
  await expect(page.locator('.evidence-comparison tbody tr')).toHaveCount(3);
  await expect(page.locator('.evidence-comparison tbody tr').nth(1)).toContainText('1,195.00');
  await expect(page.locator('.evidence-comparison tbody tr').nth(2)).toContainText('945.00');
  await page.getByRole('button',{name:'Calculate reviewed assessment'}).click();
  await expect(page.getByRole('heading',{name:'Aina Rahman'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Same applicant. A clearer picture.'})).toBeVisible();
  await page.getByRole('button',{name:/Assessment history/}).click();
  await page.locator('tbody tr').first().getByRole('button').click();
  await expect(page.locator('.evidence-comparison tbody tr').nth(2)).toContainText('945.00');
});

test('PDF file chooser uploads a fictional statement on mobile',async({page})=>{
  const encoded=execFileSync('.venv/bin/python',['-c','from backend.documents import demo_pack; import base64; print(base64.b64encode(demo_pack()[0][1]).decode())'],{encoding:'utf8'}).trim();
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.getByRole('button',{name:'Document intake'}).click();
  await page.getByLabel('Choose documents',{exact:true}).setInputFiles({name:'synthetic-bank.pdf',mimeType:'application/pdf',buffer:Buffer.from(encoded,'base64')});
  await expect(page.getByText('Totals reconcile')).toBeVisible();
  await expect(page.getByText('1 unique documents',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
  await page.getByRole('button',{name:'Discard review batch'}).click();
  await expect(page.getByText('Totals reconcile')).toHaveCount(0);
});

test('document review flows through to a saved assessment',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Document intake'}).click();
  await page.getByRole('button',{name:'Try synthetic document pack'}).click();
  await expect(page.getByText('6 unique documents',{exact:false})).toBeVisible();
  await expect(page.getByText('Totals reconcile')).toHaveCount(6);
  const calculate=page.getByRole('button',{name:'Calculate reviewed assessment'});
  await expect(calculate).toBeDisabled();
  await page.getByRole('button',{name:'Reveal local values'}).click();
  await expect(page.getByText('SALARY / CLIENT PAYOUT',{exact:true})).toHaveCount(6);
  for(const checkbox of await page.locator('.doc-confirm input').all()) await checkbox.check();
  await calculate.click();
  await expect(page.getByRole('heading',{name:'Private applicant'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Within demo capacity'})).toBeVisible();
  await expect(page.getByText('Default probability · Unavailable')).toBeVisible();
});

test('assess, change policy, reassess and inspect audit history',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Aina Rahman'})).toBeVisible();
  await page.getByRole('button',{name:'Run assessment',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Within demo capacity'})).toBeVisible();
  await expect(page.getByText('Default probability · Unavailable')).toBeVisible();
  await page.getByRole('button',{name:'Add next demo month'}).click();
  await expect(page.getByRole('heading',{name:'One more month. A fresh assessment.'})).toBeVisible();
  await page.getByRole('button',{name:'Policy',exact:true}).click();
  await page.getByLabel('Income reduction (%)').fill('40');
  await expect(page.getByText('Inputs have changed.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Save & assess'}).click();
  await expect(page.getByRole('heading',{name:'Exceeds demo capacity'})).toBeVisible();
  await page.getByRole('button',{name:/Assessment history/}).click();
  await expect(page.getByRole('heading',{name:'Every assessment, traceable.'})).toBeVisible();
  await page.locator('tbody tr').first().getByRole('button').click();
  await expect(page.getByRole('heading',{name:'Exceeds demo capacity'})).toBeVisible();
});

test('business and short-history cases have distinct outcomes',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Seasonal microbusiness'}).click();
  await page.getByRole('button',{name:'Run assessment',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Exceeds demo capacity'})).toBeVisible();
  await page.getByRole('button',{name:'Limited history'}).click();
  await page.getByRole('button',{name:'Run assessment',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Insufficient evidence'})).toBeVisible();
});

test('real-data benchmark renders all six measured experiments',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Model benchmark'}).click();
  await expect(page.getByRole('heading',{name:'Three models. Two evidence sets.'})).toBeVisible();
  await expect(page.locator('.benchmark-table tbody tr')).toHaveCount(6);
  await page.getByRole('button',{name:'Explore XGBoost behavioural',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Calibration · XGBoost'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'A held-out borrower, explained'})).toBeVisible();
});

test('mobile keeps assessment and upload controls available',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Upload CSV'})).toBeVisible();
  await page.getByRole('button',{name:'Run assessment',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Within demo capacity'})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  expect(overflow).toBe(false);
});

test('new CSV application validates and evaluates',async({page,request})=>{
  const csv=await (await request.get('/api/scenarios/worker/csv')).body();
  await page.goto('/');
  await page.getByRole('button',{name:'New application',exact:true}).click();
  await page.getByLabel('Applicant name').fill('Test Applicant');
  await page.getByLabel('Financing purpose').fill('Equipment');
  await page.getByLabel('Upload transaction CSV').setInputFiles({name:'sample.csv',mimeType:'text/csv',buffer:csv});
  await expect(page.getByText('CSV parsed.',{exact:false})).toBeVisible();
  await page.getByLabel('Statement starts').fill('2026-01-01');
  await page.getByLabel('Statement ends').fill('2026-06-30');
  await page.getByLabel('These are simulated demonstration records').check();
  await page.getByRole('button',{name:'Save & assess'}).click();
  await expect(page.getByRole('heading',{name:'Within demo capacity'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Test Applicant'})).toBeVisible();
});
