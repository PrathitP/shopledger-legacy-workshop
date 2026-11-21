'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');
var invoice = require('../lib/invoice');

function riceOrder() {
  var items = [{
    id: 1,
    sku: 'RICE-1',
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 1
  }];
  var billed = pricing.computeTotals(items, '');

  return {
    id: 41,
    date: '2026-11-21',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    items: items,
    coupon: '',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
}

test('invoice matches the billed HSN slab totals for rice order', function () {
  var order = riceOrder();
  var billed = pricing.computeTotals(order.items, order.coupon);
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(tax.getRateForItem(order.items[0]), 0.05);
  assert.deepEqual(
    { subtotal: billed.subtotal, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total },
    { subtotal: 100, tax: 5, cgst: 2.5, sgst: 2.5, total: 105 }
  );
  assert.deepEqual(
    { subtotal: invoiceFigures.subtotal, tax: invoiceFigures.tax, cgst: invoiceFigures.cgst, sgst: invoiceFigures.sgst, total: invoiceFigures.total, rowGstPercent: invoiceFigures.rows[0].gstPercent },
    { subtotal: billed.subtotal, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total, rowGstPercent: billed.lines[0].gstPercent }
  );
});

test('invoice render reflects billed HSN totals without a reconciliation warning', function () {
  var order = riceOrder();
  var html = invoice.render(order);

  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹5\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice uses billed post-discount taxable value for flat-coupon GST', function () {
  var items = [{ id: 2, name: 'Rice', hsn: '1006', price: 500, qty: 1 }];
  var billed = pricing.computeTotals(items, 'FLAT50');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'FLAT50' });

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, taxable: billed.taxable, tax: billed.tax, total: billed.total },
    { subtotal: 500, discount: 50, taxable: 450, tax: 22.5, total: 472.5 }
  );
  assert.deepEqual(
    { subtotal: invoiceFigures.subtotal, discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { subtotal: 500, discount: 50, tax: 22.5, total: 472.5 }
  );
});

test('invoice uses the same decimal gstRate interpretation as billing', function () {
  var items = [{ id: 3, name: 'Rice', hsn: '1006', gstRate: 0.05, price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(
    { tax: billed.tax, total: billed.total, rowGstPercent: billed.lines[0].gstPercent },
    { tax: 5, total: 105, rowGstPercent: 5 }
  );
  assert.deepEqual(
    { tax: invoiceFigures.tax, total: invoiceFigures.total, rowGstPercent: invoiceFigures.rows[0].gstPercent },
    { tax: 5, total: 105, rowGstPercent: 5 }
  );
});
