import { test, expect } from '@playwright/test';

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
