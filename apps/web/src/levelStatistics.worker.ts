// SPDX-License-Identifier: MPL-2.0
import {deriveLevelActivityStatistics,type LevelActivityStatistics} from '@ib-field-notes/domain';

export type LevelStatisticsInput=Parameters<typeof deriveLevelActivityStatistics>[0];
export type LevelStatisticsReply={result:LevelActivityStatistics;error?:never}|{error:string;result?:never};

self.onmessage=(event:MessageEvent<LevelStatisticsInput>)=>{
  try {
    self.postMessage({result:deriveLevelActivityStatistics(event.data)} satisfies LevelStatisticsReply);
  }catch(error){
    self.postMessage({error:error instanceof Error?error.message:String(error)} satisfies LevelStatisticsReply);
  }
};
