import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 12);
  const gestorPassword = await bcrypt.hash("gestor123", 12);
  const vigilantePassword = await bcrypt.hash("vigilante123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@vistoriasolar.com" },
    update: {},
    create: { name: "Administrador Geral", email: "admin@vistoriasolar.com", passwordHash: adminPassword, role: "ADMIN" },
  });

  await prisma.user.upsert({
    where: { email: "gestor@vistoriasolar.com" },
    update: {},
    create: { name: "Gestora de Operação", email: "gestor@vistoriasolar.com", passwordHash: gestorPassword, role: "GESTOR" },
  });

  await prisma.user.upsert({
    where: { email: "vigilante@vistoriasolar.com" },
    update: {},
    create: { name: "Vigilante de Campo", email: "vigilante@vistoriasolar.com", passwordHash: vigilantePassword, role: "VIGILANTE" },
  });

  const plant = await prisma.plant.upsert({
    where: { code: "USINA-01" },
    update: {},
    create: {
      name: "Usina Solar Horizonte",
      code: "USINA-01",
      ownerCompany: "Apolo Energia",
      state: "BA",
      city: "Bom Jesus da Lapa",
      latitude: -13.2558,
      longitude: -43.4181,
      areaHectares: 120,
      status: "ATIVA",
      operationDate: new Date("2023-06-01"),
    },
  });

  const equipmentSeeds = [
    { code: "PORT-01", name: "Portão Principal", type: "Portão", latOffset: 0, lonOffset: 0 },
    { code: "SUB-01", name: "Subestação", type: "Subestação", latOffset: 0.001, lonOffset: 0.0005 },
    { code: "INV-01", name: "Inversor 01", type: "Inversor", latOffset: 0.0015, lonOffset: 0.001 },
    { code: "INV-02", name: "Inversor 02", type: "Inversor", latOffset: 0.0018, lonOffset: 0.0015 },
    { code: "TRAFO-01", name: "Centro de Transformação", type: "Centro de transformação", latOffset: 0.0012, lonOffset: 0.0018 },
    { code: "PORT-02", name: "Portão Secundário", type: "Portão", latOffset: 0.0005, lonOffset: 0.002 },
  ];

  for (const eq of equipmentSeeds) {
    const existing = await prisma.equipment.findUnique({
      where: { plantId_code: { plantId: plant.id, code: eq.code } },
    });
    if (existing) continue;

    const equipment = await prisma.equipment.create({
      data: {
        plantId: plant.id,
        code: eq.code,
        name: eq.name,
        type: eq.type,
        latitude: plant.latitude + eq.latOffset,
        longitude: plant.longitude + eq.lonOffset,
      },
    });
    await prisma.qrCode.create({ data: { equipmentId: equipment.id, token: randomUUID() } });
  }

  console.log("Seed concluído.");
  console.log("Login admin: admin@vistoriasolar.com / admin123");
  console.log("Login gestor: gestor@vistoriasolar.com / gestor123");
  console.log("Login vigilante: vigilante@vistoriasolar.com / vigilante123");
  console.log(`Admin id: ${admin.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
