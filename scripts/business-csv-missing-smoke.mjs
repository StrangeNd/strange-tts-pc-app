import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const appJs = fs.readFileSync('public/app.js', 'utf8');
const start = appJs.indexOf('function hasMetricValue');
const end = appJs.indexOf('function readFileAsBase64', start);
assert.notEqual(start, -1, 'public/app.js should define hasMetricValue before CSV export helpers');
assert.notEqual(end, -1, 'public/app.js should keep CSV export before readFileAsBase64');

const context = {
  groupedRows(result, key) {
    return Number(result.groupedRows?.[key] || 0);
  }
};
vm.createContext(context);
vm.runInContext(`${appJs.slice(start, end)}\nthis.exportBusinessPlanCsv = exportBusinessPlanCsv;`, context);

const missingCsv = context.exportBusinessPlanCsv({
  period: 'missing-fixture',
  plan: { period: 'next', targetRevenue: 0, suggestedAdsBudget: 0, breakEvenRoi: null, actions: [], focusSkus: [] },
  groupedRows: {},
  kpis: { revenue: 0, netProfitEstimate: 0, netMargin: null },
  costs: { adsActualCost: 0 },
  ads: {
    actual: {
      rowsUsed: 1,
      hasSpendComponent: false,
      components: [
        { key: 'cash', value: 0, available: false },
        { key: 'credit', value: 0, available: false },
        { key: 'adsCreditDirect', value: 0, available: false },
        { key: 'adsCreditProrated', value: 0, available: false }
      ]
    }
  },
  orders: { refundCancel: { available: false, affectedOrders: 0, affectedRate: 0, amount: 0 } },
  content: { video: { gmv: 0 }, livestream: { gmv: 0 } },
  affiliate: { performance: { available: false, gmv: 0 } }
});

for (const expected of [
  'KPI,Doanh thu cu,missing',
  'KPI,Loi nhuan uoc tinh,missing',
  'KPI,Net margin,missing',
  'Ads,Chi phi thuc te,missing',
  'Ads,Cash,missing',
  'Ads,Credit,missing',
  'Ads,Ads credit direct,missing',
  'Ads,Ads credit prorated,missing',
  'Orders,Refund/cancel orders,missing',
  'Orders,Refund/cancel rate,missing',
  'Orders,Refund/cancel amount,missing',
  'Content,GMV Video,missing',
  'Content,GMV Livestream,missing',
  'Content,GMV Product affiliate,missing',
  'Ke hoach,ROI hoa von,missing'
]) {
  assert(missingCsv.includes(expected), `missing CSV should include ${expected}`);
}

const zeroCsv = context.exportBusinessPlanCsv({
  period: 'zero-fixture',
  plan: { period: 'next', targetRevenue: 0, suggestedAdsBudget: 0, breakEvenRoi: 0, actions: [], focusSkus: [] },
  groupedRows: { orders: 1, video: 1, livestream: 1 },
  kpis: { revenue: 0, netProfitEstimate: 0, netMargin: null },
  costs: { adsActualCost: 0 },
  ads: {
    actual: {
      rowsUsed: 1,
      hasSpendComponent: true,
      components: [
        { key: 'cash', value: 0, available: true },
        { key: 'credit', value: 0, available: true },
        { key: 'adsCreditDirect', value: 0, available: true },
        { key: 'adsCreditProrated', value: 0, available: true }
      ]
    }
  },
  orders: { refundCancel: { available: true, affectedOrders: 0, affectedRate: 0, amount: 0 } },
  content: { video: { gmv: 0 }, livestream: { gmv: 0 } },
  affiliate: { performance: { available: true, gmv: 0 } }
});

for (const expected of [
  'KPI,Doanh thu cu,0',
  'KPI,Loi nhuan uoc tinh,0',
  'Ads,Chi phi thuc te,0',
  'Ads,Cash,0',
  'Ads,Credit,0',
  'Ads,Ads credit direct,0',
  'Ads,Ads credit prorated,0',
  'Orders,Refund/cancel orders,0',
  'Orders,Refund/cancel rate,0.0%',
  'Orders,Refund/cancel amount,0',
  'Content,GMV Video,0',
  'Content,GMV Livestream,0',
  'Content,GMV Product affiliate,0',
  'Ke hoach,ROI hoa von,0.00'
]) {
  assert(zeroCsv.includes(expected), `explicit zero CSV should include ${expected}`);
}

console.log('Business CSV missing smoke passed.');
