import { db } from "./db";
import { users, videos } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

// Seed users that own the videos
const SEED_USERS = [
  { username: "rafnoxxx", password: process.env.SEED_USER_PASSWORD ?? "", displayName: "@bigpekob" },
  { username: "mamud", password: process.env.SEED_USER_PASSWORD ?? "", displayName: null },
];

// Video manifest - all videos uploaded in dev with their metadata
const VIDEO_MANIFEST: Array<{ ownerUsername: string; title: string; description: string; fileUrl: string; mimeType: string }> = [
  { ownerUsername: "rafnoxxx", title: "bokep enak", description: "", fileUrl: "/uploads/1772742171145-85156737.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "vcs", description: "", fileUrl: "/uploads/1772774880941-560687205.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "enakeun", description: "", fileUrl: "/uploads/1772775256866-562997824.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "tobrut", description: "", fileUrl: "/uploads/1772775304612-630273597.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "jas biru", description: "", fileUrl: "/uploads/1772775373906-27213327.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "ngentot", description: "", fileUrl: "/uploads/1772775355992-288975056.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "tobrut cantik", description: "", fileUrl: "/uploads/1772775428903-988600456.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "vcs 2", description: "", fileUrl: "/uploads/1772775489615-256507960.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "memeknya masih sempit", description: "", fileUrl: "/uploads/1772775552676-48890571.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "pertama kali ngentot kesakitan", description: "", fileUrl: "/uploads/1772775601123-425942537.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "lanjutan", description: "", fileUrl: "/uploads/1772775620250-554614296.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "lanjutan 2", description: "", fileUrl: "/uploads/1772775634747-434136219.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "ngentot sambil joget", description: "", fileUrl: "/uploads/1772775519654-594282883.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "hijab sangean", description: "", fileUrl: "/uploads/1772775656464-931065088.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "malay", description: "", fileUrl: "/uploads/1772775857918-605999979.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "lanjutan 3", description: "", fileUrl: "/uploads/1772775714744-263877653.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "memek bocil", description: "", fileUrl: "/uploads/1772775944085-755431306.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "sepongin pacar", description: "", fileUrl: "/uploads/1772775987575-352730589.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "bokep", description: "", fileUrl: "/uploads/1772775962500-220598147.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "main pake dildo", description: "", fileUrl: "/uploads/1772776069893-492122312.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "kesakitan", description: "", fileUrl: "/uploads/1772776053298-52720837.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "ngentot sama pacar", description: "", fileUrl: "/uploads/1772776121732-483530169.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "bokep bule", description: "", fileUrl: "/uploads/1772776209162-251413497.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "1", description: "", fileUrl: "/uploads/1772776247809-236890558.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "2", description: "", fileUrl: "/uploads/1772776422782-693262077.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "tobrutt", description: "", fileUrl: "/uploads/1772776483200-227203216.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "tobrutt 1", description: "", fileUrl: "/uploads/1772776611355-76506328.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "tobrut 2", description: "", fileUrl: "/uploads/1772776645376-398348486.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "tobrut 3", description: "", fileUrl: "/uploads/1772776670342-590980605.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "tobrut 4", description: "", fileUrl: "/uploads/1772776708675-680634190.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "colmek bulunya banyak banget", description: "", fileUrl: "/uploads/1772776738062-298233921.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "tobrut mainin toket", description: "", fileUrl: "/uploads/1772776794567-347558585.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "tobrut bulu banyak colmek 2", description: "", fileUrl: "/uploads/1772776833360-556433511.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "ngentot nyantai", description: "", fileUrl: "/uploads/1772776890645-47947389.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "hijab kacamata main dildo", description: "", fileUrl: "/uploads/1772777047028-161391100.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "colmek sambil tiktokan", description: "", fileUrl: "/uploads/1772777088098-641607464.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "memeknya tembem banget", description: "", fileUrl: "/uploads/1772777112358-696218758.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "bikini hijau", description: "", fileUrl: "/uploads/1772783358633-577010136.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "sepongan pacar", description: "", fileUrl: "/uploads/1772784340661-340945035.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "lanjutan 4", description: "", fileUrl: "/uploads/1772784545502-201896622.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "baru pertama kali jadi malu", description: "", fileUrl: "/uploads/1772784973643-535704843.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "rambut merah", description: "", fileUrl: "/uploads/1772786442792-145976928.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "caca tobrut seleb tiktok open BO", description: "", fileUrl: "/uploads/1772825797718-417039986.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "gatau judulnya", description: "", fileUrl: "/uploads/1772825855614-47302538.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "caca tobrut open BO", description: "", fileUrl: "/uploads/1772825955753-945468376.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "vivi sepi bukan sapi ngewe dikamar mandi", description: "", fileUrl: "/uploads/1772826051369-203404878.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "hijab tobrut mantep banget", description: "", fileUrl: "/uploads/1772826100916-893892066.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "vivi sepi bukan sapi make kostum kelinci part 1", description: "", fileUrl: "/uploads/1772826158776-797859563.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "vivi sepi bukan sapi make kostum kelinci part 2", description: "#fypp #sepibukansapi", fileUrl: "/uploads/1772826270685-954786642.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "ngewe sambil ngobrol enak ya", description: "", fileUrl: "/uploads/1772826877188-351794647.mp4", mimeType: "video/mp4" },
  { ownerUsername: "mamud", title: "hijab tobrut baju batik", description: "", fileUrl: "/uploads/1772876579757-921097913.mp4", mimeType: "video/mp4" },
  { ownerUsername: "mamud", title: "memeknya dimainin pacarnya", description: "", fileUrl: "/uploads/1772885125771-685419499.mp4", mimeType: "video/mp4" },
  { ownerUsername: "mamud", title: "lagi mabuk malah diperkosa pacar", description: "", fileUrl: "/uploads/1772885265673-497198369.mp4", mimeType: "video/mp4" },
  { ownerUsername: "mamud", title: "tobrut banget bikin sange", description: "", fileUrl: "/uploads/1772885901841-293996552.mp4", mimeType: "video/mp4" },
  { ownerUsername: "mamud", title: "tobrut remes remes tete", description: "", fileUrl: "/uploads/1772886085749-214163543.mp4", mimeType: "video/mp4" },
  { ownerUsername: "mamud", title: "ngewe sama tante tobrut emang enak banget", description: "", fileUrl: "/uploads/1772886605824-217796792.mp4", mimeType: "video/mp4" },
  { ownerUsername: "mamud", title: "tobrut colmek", description: "", fileUrl: "/uploads/1772887813283-141931403.mp4", mimeType: "video/mp4" },
  { ownerUsername: "mamud", title: "tante tobrut", description: "", fileUrl: "/uploads/1772888011931-307732775.mp4", mimeType: "video/mp4" },
  { ownerUsername: "mamud", title: "colmek pake timun", description: "", fileUrl: "/uploads/1772888388111-63915191.mp4", mimeType: "video/mp4" },
  { ownerUsername: "mamud", title: "hijab baju pink colmek", description: "", fileUrl: "/uploads/1772888716027-222965527.mp4", mimeType: "video/mp4" },
  { ownerUsername: "mamud", title: "vivi tobrut colmek", description: "", fileUrl: "/uploads/1772888817988-701259685.mp4", mimeType: "video/mp4" },
  { ownerUsername: "mamud", title: "colmek colmek", description: "", fileUrl: "/uploads/1772888902397-946834024.mp4", mimeType: "video/mp4" },
  { ownerUsername: "mamud", title: "open bo", description: "", fileUrl: "/uploads/1772889036702-216811831.mp4", mimeType: "video/mp4" },
  { ownerUsername: "mamud", title: "tante tobrut colmek", description: "", fileUrl: "/uploads/1772889345882-315229604.mp4", mimeType: "video/mp4" },
  { ownerUsername: "mamud", title: "judulnya tobrut", description: "", fileUrl: "/uploads/1772889487280-586237335.mp4", mimeType: "video/mp4" },
  { ownerUsername: "mamud", title: "tobrut baik", description: "", fileUrl: "/uploads/1772889643571-880801219.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "udah keluar didalem tetep lanjut karena enak", description: "", fileUrl: "/uploads/1772924304596-879446494.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "vivi sepi bukan sapi kostum spider woman ngentot terbaru", description: "", fileUrl: "/uploads/1772956687617-583896233.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "notstarla tiktokers tobrut cantik kompilasi", description: "", fileUrl: "/uploads/1772967545538-540273574.mp4", mimeType: "video/mp4" },
  { ownerUsername: "rafnoxxx", title: "notstarla tiktokers tobrut cantik kompilasi part 2", description: "", fileUrl: "/uploads/1772968326702-743369562.mp4", mimeType: "video/mp4" },
];

export async function runStartupSeed() {
  try {
    // Check if videos already seeded
    const [{ count }] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(videos);
    if (count > 0) {
      console.log(`[seed] ${count} videos already in DB, skipping seed`);
      return;
    }

    console.log("[seed] Empty DB detected, running startup seed...");

    // Ensure admin exists
    const adminExists = await db.select().from(users).where(eq(users.username, "admin"));
    if (!adminExists.length) {
      await db.insert(users).values({ username: "admin", password: process.env.ADMIN_PASSWORD ?? "password" });
    }

    // Create seed users and build username->id map
    const userIdMap: Record<string, number> = {};
    for (const seedUser of SEED_USERS) {
      const existing = await db.select().from(users).where(eq(users.username, seedUser.username));
      if (existing.length) {
        userIdMap[seedUser.username] = existing[0].id;
        // Update displayName if needed
        if (seedUser.displayName && !existing[0].displayName) {
          await db.update(users).set({ displayName: seedUser.displayName }).where(eq(users.id, existing[0].id));
        }
      } else {
        const [newUser] = await db.insert(users).values({
          username: seedUser.username,
          password: seedUser.password,
          displayName: seedUser.displayName,
        }).returning();
        userIdMap[seedUser.username] = newUser.id;
      }
      console.log(`[seed] User ${seedUser.username} -> id ${userIdMap[seedUser.username]}`);
    }

    // Only seed videos whose file exists on disk
    const uploadDir = path.join(process.cwd(), "uploads");
    let seeded = 0;
    let skipped = 0;

    for (const v of VIDEO_MANIFEST) {
      const userId = userIdMap[v.ownerUsername];
      if (!userId) { skipped++; continue; }

      const filePath = path.join(process.cwd(), v.fileUrl.startsWith("/") ? v.fileUrl.slice(1) : v.fileUrl);
      if (!fs.existsSync(filePath)) {
        skipped++;
        continue;
      }

      await db.insert(videos).values({
        userId,
        title: v.title,
        description: v.description,
        fileUrl: v.fileUrl,
        mimeType: v.mimeType,
      });
      seeded++;
    }

    console.log(`[seed] Done! Seeded ${seeded} videos, skipped ${skipped}`);
  } catch (err) {
    console.error("[seed] Startup seed error:", err);
  }
}
