# Test Payloads: Merged n8n Media Generation Workflow

This document provides complete JSON payloads to test the merged n8n workflow at `POST /generate-media`. These tests cover **Image** and **Short Video** (4-scene funny story about dog food), with and without reference images.

---

## 1. Image: Without Reference Image (ภาพนิ่ง - ไม่แนบรูปอ้างอิง)

**วัตถุประสงค์**: ทดสอบการสร้างภาพนิ่งแบบมาตรฐานโดยใช้แคปชั่นและคำอธิบายเบื้องต้น

```json
{
  "callbackUrl": "http://localhost:3000/internal/ai/image/callback",
  "jobId": "8f8b8a8c-1234-5678-abcd-ef1234567890",
  "postId": "9a9b9c9d-1234-5678-abcd-ef1234567890",
  "type": "image",
  "upload": {
    "method": "PUT",
    "presignedUrl": "http://minio:9000/posts/media/2026/06/29/test_dogfood_image.png?X-Amz-Signature=xxx",
    "storageKey": "posts/media/2026/06/29/test_dogfood_image.png",
    "publicUrl": "http://minio:9000/posts/media/2026/06/29/test_dogfood_image.png",
    "headers": {
      "Content-Type": "image/png"
    }
  },
  "business": {
    "id": "b1b2b3b4-1234-5678-abcd-ef1234567890",
    "name": "โฮ่งโฮ่ง พรีเมียม (HongHong Premium)",
    "industry": "สัตว์เลี้ยงและอาหารสัตว์",
    "tone": "ร่าเริง ตลก เป็นมิตร และรักสัตว์",
    "keywords": ["อาหารสุนัขเกรดพรีเมียม", "ขนสวยแข็งแรง", "รสเนื้อแกะ"],
    "logoPublicUrl": "http://minio:9000/logos/happy_dog_logo.png"
  },
  "postType": "promotion",
  "caption": "ลูกรักเบื่ออาหารใช่ไหม? 🐶 ให้ 'โฮ่งโฮ่ง พรีเมียม' เปลี่ยนมื้อธรรมดาให้เป็นมื้อพิเศษ! ด้วยสูตรเนื้อแกะรมควันชั้นดี เม็ดเคี้ยวง่าย บำรุงขนสวย สุขภาพแข็งแรงจนต้องขอเพิ่ม! 🍖🌟",
  "style": "colorful_playful",
  "aspect_ratio": "1:1",
  "prompt": "ถุงอาหารสุนัข 'โฮ่งโฮ่ง พรีเมียม' วางคู่กับถ้วยอาหารที่มีอาหารสุนัขรูปเม็ดสีน้ำตาลเข้มหรูหรา และมีเนื้อแกะย่างชิ้นโตวางอยู่ด้านข้าง บนพื้นหลังสีพาสเทลสดใส มีแสงแดดอุ่นๆ ส่องลงมา ดูน่าอร่อยและร่าเริง"
}
```

---

## 2. Image: With Reference Image (ภาพนิ่ง - แนบรูปอ้างอิง)

**วัตถุประสงค์**: ทดสอบระบบดาวน์โหลดรูปภาพอ้างอิง แปลงเป็น Base64 แล้วส่งให้ Gemini 2.5 Flash เพื่อขยาย Prompt และควบคุมภาพโกลเดนรีทรีฟเวอร์ให้ใกล้เคียงกับรูปต้นแบบ

```json
{
  "callbackUrl": "http://localhost:3000/internal/ai/image/callback",
  "jobId": "7f7b7a7c-1234-5678-abcd-ef1234567890",
  "postId": "8a8b8c8d-1234-5678-abcd-ef1234567890",
  "type": "image",
  "upload": {
    "method": "PUT",
    "presignedUrl": "http://minio:9000/posts/media/2026/06/29/test_dogfood_ref.png?X-Amz-Signature=xxx",
    "storageKey": "posts/media/2026/06/29/test_dogfood_ref.png",
    "publicUrl": "http://minio:9000/posts/media/2026/06/29/test_dogfood_ref.png",
    "headers": {
      "Content-Type": "image/png"
    }
  },
  "business": {
    "id": "b1b2b3b4-1234-5678-abcd-ef1234567890",
    "name": "โฮ่งโฮ่ง พรีเมียม (HongHong Premium)",
    "industry": "สัตว์เลี้ยงและอาหารสัตว์",
    "tone": "ร่าเริง ตลก เป็นมิตร และรักสัตว์",
    "keywords": ["อาหารสุนัขเกรดพรีเมียม", "ขนสวยแข็งแรง"],
    "logoPublicUrl": "http://minio:9000/logos/happy_dog_logo.png"
  },
  "postType": "product_showcase",
  "caption": "ดูความเงางามของขนสิครับ! ✨ หลังเปลี่ยนมาทานอาหารสุนัขเกรดพรีเมียม สูตรบำรุงลึกจากภายใน สุขภาพดีขนสวยวิ้งค์จนสุนัขข้างบ้านต้องมองแรง! 🐕💖",
  "style": "clean_modern",
  "aspect_ratio": "1:1",
  "prompt": "รูปสุนัขพันธุ์โกลเดนรีทรีฟเวอร์ขนยาวสลวยเป็นประกายสีทองเงางาม นั่งยิ้มแฉ่งโชว์ฟันขาวอย่างมีความสุขถัดจากชามอาหารสุนัขพรีเมียมสีน้ำเงินเข้ม",
  "referenceImageUrls": [
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS5fB7JBAFRedAHNUYaWsdCPRM-5tWWqFogOGoq1fv34ZwKualYUIDBKz8&s=10"
  ]
}
```

---

## 3. Video: Without Reference Image (วิดีโอ - ไม่แนบรูปอ้างอิง 4 ฉาก)

**วัตถุประสงค์**: ทดสอบการสร้างวิดีโอแบบต่อเนื่องทีละฉาก (Veo 3.1 Video Extension) ตามเนื้อเรื่อง 4 ฉากแนวขำขันเกี่ยวกับสุนัขโกลเดนรีทรีฟเวอร์

```json
{
  "callbackUrl": "http://localhost:3000/internal/ai/short_video/callback",
  "jobId": "6f6b6a6c-1234-5678-abcd-ef1234567890",
  "postId": "7a7b7c7d-1234-5678-abcd-ef1234567890",
  "type": "short_video",
  "upload": {
    "method": "PUT",
    "presignedUrl": "http://minio:9000/posts/media/2026/06/29/test_dogfood_video.mp4?X-Amz-Signature=xxx",
    "storageKey": "posts/media/2026/06/29/test_dogfood_video.mp4",
    "publicUrl": "http://minio:9000/posts/media/2026/06/29/test_dogfood_video.mp4",
    "headers": {
      "Content-Type": "video/mp4"
    }
  },
  "business": {
    "id": "b1b2b3b4-1234-5678-abcd-ef1234567890",
    "name": "โฮ่งโฮ่ง พรีเมียม (HongHong Premium)",
    "industry": "สัตว์เลี้ยงและอาหารสัตว์",
    "tone": "ร่าเริง ตลก เป็นมิตร และรักสัตว์",
    "keywords": ["อาหารสุนัขเกรดพรีเมียม", "ขนสวยแข็งแรง"],
    "logoPublicUrl": "http://minio:9000/logos/happy_dog_logo.png"
  },
  "postType": "brand_awareness",
  "caption": "เบื่อข้าวแบบเดิมๆ ใช่ไหมโฮ่ง? 😂 ดูวิถีชีวิตโกลเดนสุดดราม่าเมื่อเจออาหารเม็ดแบบเก่า ปะทะมื้อระดับจักรพรรดิจากโฮ่งโฮ่ง พรีเมียม! ความอร่อยระดับที่หางสั่นจนหมุนเป็นใบพัดเฮลิคอปเตอร์! 🚁🐶🍖",
  "style": "cinematic_funny",
  "aspect_ratio": "9:16",
  "master_prompt": "A funny and engaging 4-scene video sequence showcasing a cute golden retriever's dramatic transformation when tasting premium dog food. Colors are bright, cinematic lighting, vertical 9:16 aspect ratio.",
  "scenes": [
    {
      "scene_prompt": "Scene 1: A cute golden retriever dog sits dramatically in front of a steel bowl containing plain white rice. The dog is looking incredibly sad, sighing deeply like a tired human, leaning its head on its paws with puppy eyes.",
      "scene_index": 0
    },
    {
      "scene_prompt": "Scene 2: Transition from scene 1. A hand pours delicious brown, shiny meat-flavored dog food kibbles into the bowl in satisfying slow motion. Real steam and savory meat pieces mix in. The dog's eyes immediately pop wide open in excitement.",
      "scene_index": 1
    },
    {
      "scene_prompt": "Scene 3: Transition from scene 2. The golden retriever devours the food enthusiastically, chewing happily with ears flapping. Its tail is wagging so incredibly fast that it looks like a rotating helicopter propeller, creating a funny gust of wind in the room.",
      "scene_index": 2
    },
    {
      "scene_prompt": "Scene 4: Transition from scene 3. The retriever is lying on a plush rug, looking extremely full and blissfully content with a goofy smile on its face, gently patting its round stomach with a paw. A bag of 'HongHong Premium' dog food stands next to the bowl.",
      "scene_index": 3
    }
  ]
}
```

---

## 4. Video: With Reference Image (วิดีโอ - แนบรูปอ้างอิง 4 ฉาก)

**วัตถุประสงค์**: ทดสอบการดาวน์โหลดรูปอ้างอิง (เช่น สุนัขคอร์กี้) แล้วส่งเป็นเฟรมเริ่มต้นในการสร้างวิดีโอ 4 ฉาก เพื่อคงลักษณะหน้าตาของสุนัขให้ตรงตามภาพอ้างอิงตลอดทั้งคลิป

```json
{
  "callbackUrl": "http://localhost:3000/internal/ai/short_video/callback",
  "jobId": "5f5b5a5c-1234-5678-abcd-ef1234567890",
  "postId": "6a6b6c6d-1234-5678-abcd-ef1234567890",
  "type": "short_video",
  "upload": {
    "method": "PUT",
    "presignedUrl": "http://minio:9000/posts/media/2026/06/29/test_dogfood_video_ref.mp4?X-Amz-Signature=xxx",
    "storageKey": "posts/media/2026/06/29/test_dogfood_video_ref.mp4",
    "publicUrl": "http://minio:9000/posts/media/2026/06/29/test_dogfood_video_ref.mp4",
    "headers": {
      "Content-Type": "video/mp4"
    }
  },
  "business": {
    "id": "b1b2b3b4-1234-5678-abcd-ef1234567890",
    "name": "โฮ่งโฮ่ง พรีเมียม (HongHong Premium)",
    "industry": "สัตว์เลี้ยงและอาหารสัตว์",
    "tone": "ร่าเริง ตลก เป็นมิตร และรักสัตว์",
    "keywords": ["อาหารสุนัขเกรดพรีเมียม", "ขนสวยแข็งแรง"],
    "logoPublicUrl": "http://minio:9000/logos/happy_dog_logo.png"
  },
  "postType": "product_showcase",
  "caption": "นี่คือหน้าตาของลูกสุนัขคอร์กี้สุดกวนเมื่อรู้ว่าจะได้กินอาหารสุนัข 'โฮ่งโฮ่ง พรีเมียม'! 🐶❤️ อร่อยฟินสุดจนต้องโชว์ท่าเต้นก้นดุ๊กดิ๊กท้าทายทุกสายตา!",
  "style": "cute_playful",
  "aspect_ratio": "9:16",
  "referenceImageUrls": [
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS5fB7JBAFRedAHNUYaWsdCPRM-5tWWqFogOGoq1fv34ZwKualYUIDBKz8&s=10"
  ],
  "master_prompt": "A funny 4-scene video sequence starring the cute corgi from the reference image, reacting to premium dog food. The dog must look consistent across all scenes. Cinematic lighting, cute dog tone.",
  "scenes": [
    {
      "scene_prompt": "Scene 1: The cute corgi from the reference image stands in the kitchen, staring intensely at a locked food cabinet, giving it a funny, highly dramatic side-eye as if plotting a heist.",
      "scene_index": 0
    },
    {
      "scene_prompt": "Scene 2: Transition from scene 1. The cabinet opens, and the dog is showered with kibbles raining down from above in slow motion. The corgi barks happily and attempts to catch kibbles mid-air with a hilarious open mouth.",
      "scene_index": 1
    },
    {
      "scene_prompt": "Scene 3: Transition from scene 2. The corgi is eating from a bowl, wagging its back and butt side-to-side in a funny, rhythmic 'wiggle dance' of happiness while eating.",
      "scene_index": 2
    },
    {
      "scene_prompt": "Scene 4: Transition from scene 3. The corgi is sitting proudly with a tiny paper crown on its head, looking like a king next to a bowl of HongHong Premium dog food, winking at the camera.",
      "scene_index": 3
    }
  ]
}
```
