"""Independent fictional files for one coherent alternative-data demonstration."""
import calendar
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, A4


def pdf(lines):
    stream=io.BytesIO(); c=canvas.Canvas(stream,pagesize=landscape(A4))
    c.setTitle('Arus fictional evidence - not a real financial document')
    c.setFont('Courier',9)
    for i,line in enumerate(lines):
        c.drawString(24,560-i*20,line)
    c.save();return stream.getvalue()


def pack():
    files=[]; earnings=[]; utilities=[]; repayment=[]; balance=4200
    incomes=[5800,6700,5900,7100,6500,6800]
    for m,income in enumerate(incomes,1):
        prefix=f'2026-{m:02}'
        entries=[(3,f'CLIENT CREDIT PAY{m:02}',income),(7,'OPERATING COSTS',-800),
            (18,'HOUSEHOLD COSTS',-1480),(19,f'UTILITY UTIL{m:02}',-120),
            (22,f'INSTALMENT OLD{m:02}',-250),(26,'OWN ACCOUNT TRANSFER',500),(28,'OWN ACCOUNT TRANSFER',-500)]
        lines=['SYNTHETIC DEMONSTRATION - NOT A REAL BANK STATEMENT','Aina Rahman - fictional freelance designer',
            'ACCOUNT NUMBER 000000000001',f'STATEMENT DATE {calendar.monthrange(2026,m)[1]}/{m:02}/26',
            'ENTRY DATE TRANSACTION DESCRIPTION TRANSACTION AMOUNT STATEMENT BALANCE',f'BEGINNING BALANCE {balance:.2f}']
        for day,desc,amount in entries:
            balance+=amount
            lines.append(f'{day:02}/{m:02}/26 {desc} {abs(amount):.2f}{"+" if amount>0 else "-"} {balance:.2f}')
        lines += [f'ENDING BALANCE : {balance:.2f}',f'TOTAL CREDIT : {income+500:.2f}','TOTAL DEBIT : 3150.00']
        files.append((f'aina-bank-{m:02}.pdf',pdf(lines)))
        earnings.append(f'payout|PAY{m:02}|{prefix}-03|{income:.2f}|-|-|-|-')
        utilities.append(f'utility|UTIL{m:02}|{prefix}-01|120.00|{prefix}-25|{prefix}-19|-|-')
        repayment.append(f'repayment|OLD{m:02}|{prefix}-01|250.00|{prefix}-25|{prefix}-22|OLDPLAN|{(6-m)*250:.2f}')
    # Another-client payout is deliberately not present in the bank account.
    earnings.append('payout|NOTBANKED|2026-06-10|99.00|-|-|-|-')
    for m in (7,8,9):
        repayment.append(f'repayment|NEW{m:02}|2026-06-30|750.00|2026-{m:02}-25|-|NEWPLAN|2250.00')
    for name,rows in [('earnings',earnings),('utility-bills',utilities),('paylater-schedule',repayment)]:
        files.append((f'aina-{name}.pdf',pdf(['SYNTHETIC DEMONSTRATION - NOT A REAL PROVIDER DOCUMENT',
            'Aina Rahman - fictional example; snapshot 2026-06-30','ARUS EVIDENCE V1',f'RECORD COUNT: {len(rows)}',
            'kind|reference|date|amount|due_date|paid_date|contract|balance']+rows)))
    return files
