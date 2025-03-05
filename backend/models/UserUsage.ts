import mongoose, { Document } from 'mongoose';

interface IUserUsage extends Document {
  userId: string;
  dailyTokens: number;
  tokenLimit: number;
  lastReset: Date;
  checkAndResetDaily(): number;
}

const userUsageSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  dailyTokens: {
    type: Number,
    default: 0
  },
  tokenLimit: {
    type: Number,
    default: 50000
  },
  lastReset: {
    type: Date,
    default: Date.now
  }
});

// Reset daily questions at 2:09 PM (14:09) Thailand time (GMT+7) each day
userUsageSchema.methods.checkAndResetDaily = function() {
  // Define Thai timezone offset (GMT+7)
  const thaiTimeOffsetMs = 7 * 60 * 60 * 1000;
  
  // Get current time in Thai timezone
  const nowUTC = new Date();
  const nowThai = new Date(nowUTC.getTime() + thaiTimeOffsetMs);
  
  // Get last reset time in Thai timezone
  const lastResetUTC = new Date(this.lastReset);
  const lastResetThai = new Date(lastResetUTC.getTime() + thaiTimeOffsetMs);
  
  // Define reset time as 23:59 Thai time
  const resetHour = 23;
  const resetMinute = 59;
  
  // Create today's reset time
  const todayResetThai = new Date(nowThai);
  todayResetThai.setHours(resetHour, resetMinute, 0, 0);
  const todayResetUTC = new Date(todayResetThai.getTime() - thaiTimeOffsetMs);
  
  // Create yesterday's reset time
  const yesterdayResetThai = new Date(todayResetThai);
  yesterdayResetThai.setDate(yesterdayResetThai.getDate() - 1);
  const yesterdayResetUTC = new Date(yesterdayResetThai.getTime() - thaiTimeOffsetMs);
  
  // Check if we need to reset
  let shouldReset = false;
  
  if (nowUTC >= todayResetUTC) {
    shouldReset = lastResetUTC < todayResetUTC;
  } else {
    shouldReset = lastResetUTC < yesterdayResetUTC;
  }
  
  if (shouldReset) {
    this.dailyTokens = 0;
    this.lastReset = nowUTC;
    this.save();
  }
  
  return this.dailyTokens;
};

export const UserUsage = mongoose.model<IUserUsage>('UserUsage', userUsageSchema);



// import mongoose, { Document } from 'mongoose';

// interface IUserUsage extends Document {
//   userId: string;
//   dailyQuestions: number;
//   lastReset: Date;
//   checkAndResetDaily(): number;
// }

// const userUsageSchema = new mongoose.Schema({
//   userId: {
//     type: String,
//     required: true,
//     unique: true
//   },
//   dailyQuestions: {
//     type: Number,
//     default: 0
//   },
//   lastReset: {
//     type: Date,
//     default: Date.now
//   }
// });

// // Reset daily questions at 2:09 PM (14:09) Thailand time (GMT+7) each day
// userUsageSchema.methods.checkAndResetDaily = function() {
//   // Define Thai timezone offset (GMT+7 = 7 hours * 60 minutes * 60 seconds * 1000 milliseconds)
//   const thaiTimeOffsetMs = 7 * 60 * 60 * 1000;
  
//   // Get current time in Thai timezone
//   const nowUTC = new Date();
//   const nowThai = new Date(nowUTC.getTime() + thaiTimeOffsetMs);
  
//   // Get last reset time in Thai timezone
//   const lastResetUTC = new Date(this.lastReset);
//   const lastResetThai = new Date(lastResetUTC.getTime() + thaiTimeOffsetMs);
  
//   // Define reset time as 14:09 (2:09 PM) Thai time
//   const resetHour = 23;
//   const resetMinute = 59;
  
//   // Create today's reset time in Thai timezone
//   const todayResetThai = new Date(nowThai);
//   todayResetThai.setHours(resetHour, resetMinute, 0, 0);
//   // Adjust to preserve the correct Thai date (removing the offset we added)
//   const todayResetUTC = new Date(todayResetThai.getTime() - thaiTimeOffsetMs);
  
//   // Create yesterday's reset time in Thai timezone
//   const yesterdayResetThai = new Date(todayResetThai);
//   yesterdayResetThai.setDate(yesterdayResetThai.getDate() - 1);
//   // Adjust to preserve the correct Thai date (removing the offset we added)
//   const yesterdayResetUTC = new Date(yesterdayResetThai.getTime() - thaiTimeOffsetMs);
  
//   // Determine if we need to reset based on the current time and last reset time
//   let shouldReset = false;
  
//   if (nowUTC >= todayResetUTC) {
//     // It's after reset time today (in Thai time), check if last reset was before today's reset time
//     shouldReset = lastResetUTC < todayResetUTC;
//   } else {
//     // It's before reset time today (in Thai time), check if last reset was before yesterday's reset time
//     shouldReset = lastResetUTC < yesterdayResetUTC;
//   }
  
//   if (shouldReset) {
//     this.dailyQuestions = 0;
//     this.lastReset = nowUTC;
//   }
  
//   return this.dailyQuestions;
// };

// export const UserUsage = mongoose.model<IUserUsage>('UserUsage', userUsageSchema);
