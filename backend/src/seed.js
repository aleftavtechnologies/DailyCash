require("dotenv").config();
const bcrypt = require("bcryptjs");
const prisma = require("./lib/prisma");

async function main() {
  const tenant = await prisma.tenant.create({ data: { companyName: "Lanka Prosperity Finance (Pvt) Ltd" } });
  const pass = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.create({ data: { tenantId: tenant.id, name: "S. Perera", phone: "0771000001", role: "admin", passwordHash: pass } });
  const accountant = await prisma.user.create({ data: { tenantId: tenant.id, name: "N. Fernando", phone: "0771000002", role: "accountant", passwordHash: pass } });
  const officer = await prisma.user.create({ data: { tenantId: tenant.id, name: "K. Silva", phone: "0771000003", role: "loan_officer", passwordHash: pass } });
  const recovery = await prisma.user.create({ data: { tenantId: tenant.id, name: "D. Wickrama", phone: "0771000004", role: "recovery_officer", passwordHash: pass } });

  // One branch = one route = exactly one loan officer.
  const branch = await prisma.branch.create({ data: { tenantId: tenant.id, name: "Maharagama", loanOfficerId: officer.id } });
  await prisma.user.updateMany({ where: { id: { in: [accountant.id, officer.id, recovery.id, admin.id] } }, data: { branchId: branch.id } });

  const product = await prisma.loanProduct.create({
    data: { tenantId: tenant.id, name: "Standard 60-Day", termDays: 60, interestType: "flat_percent", interestValue: 20 },
  });
  await prisma.loanProduct.create({
    data: { tenantId: tenant.id, name: "Extended 65-Day", termDays: 65, interestType: "flat_percent", interestValue: 22 },
  });
  await prisma.loanProduct.create({
    data: { tenantId: tenant.id, name: "Short 40-Day", termDays: 40, interestType: "flat_percent", interestValue: 15 },
  });

  // Admin issues K. Silva a starting cash float to disburse loans from.
  await prisma.cashMovement.create({
    data: { tenantId: tenant.id, branchId: branch.id, officerId: officer.id, type: "float_in", amount: 200000, recordedById: admin.id, note: "Opening float" },
  });

  const customer = await prisma.customer.create({
    data: { tenantId: tenant.id, branchId: branch.id, name: "Sunil Perera", nic: "198012345678V", phone: "0711234567", businessType: "Grocery Shop" },
  });

  // A second customer whose application is still awaiting approval, to
  // demonstrate the pending queue.
  const customer2 = await prisma.customer.create({
    data: { tenantId: tenant.id, branchId: branch.id, name: "Kamal Silva", nic: "199005678901V", phone: "0719876543", businessType: "Hardware Shop" },
  });

  // --- Loan 1: full lifecycle — submitted, approved, disbursed, collecting ---
  const principal1 = 50000, totalRepayable1 = 60000, installment1 = 1000;
  const loan1 = await prisma.loan.create({
    data: {
      tenantId: tenant.id, branchId: branch.id, customerId: customer.id, productId: product.id, officerId: officer.id,
      submittedById: officer.id, approvedById: admin.id, approvedAt: new Date(), disbursedAt: new Date(),
      principal: principal1, termDays: 60, interestValue: 20, totalRepayable: totalRepayable1,
      installmentAmount: installment1, startDate: new Date(), status: "active",
    },
  });
  await prisma.cashMovement.create({
    data: { tenantId: tenant.id, branchId: branch.id, officerId: officer.id, type: "disbursement", amount: principal1, loanId: loan1.id, recordedById: officer.id, note: `Disbursed loan ${loan1.id}` },
  });
  await prisma.payment.create({
    data: { tenantId: tenant.id, branchId: branch.id, loanId: loan1.id, customerId: customer.id, type: "document_charge", amount: 500, recordedById: officer.id, note: "Document & processing fee" },
  });
  await prisma.payment.create({
    data: { tenantId: tenant.id, branchId: branch.id, loanId: loan1.id, customerId: customer.id, type: "installment", amount: installment1, recordedById: officer.id, note: "Day 1 installment" },
  });
  await prisma.comment.create({
    data: { tenantId: tenant.id, customerId: customer.id, userId: recovery.id, text: "Friendly, reliable payer. Shop opens at 8am." },
  });

  // --- Loan 2: application submitted, awaiting Admin approval ---
  const principal2 = 30000, totalRepayable2 = 36000, installment2 = 600;
  const loan2 = await prisma.loan.create({
    data: {
      tenantId: tenant.id, branchId: branch.id, customerId: customer2.id, productId: product.id, officerId: officer.id,
      submittedById: officer.id,
      principal: principal2, termDays: 60, interestValue: 20, totalRepayable: totalRepayable2,
      installmentAmount: installment2, startDate: new Date(), status: "pending",
    },
  });

  console.log("Seeded tenant:", tenant.id);
  console.log("Branch:", branch.id, "(route officer:", officer.name + ")");
  console.log("Loan 1 (active, collecting):", loan1.id);
  console.log("Loan 2 (pending admin approval):", loan2.id);
  console.log("Login with phone 0771000001-4, password: password123, tenantId:", tenant.id);
}

main().finally(() => prisma.$disconnect());
