import {validateTiming,timingKey} from '../src/game-timing.js';
export function reportResult(source){
 if(!source)return null;const result={experienceVersion:[1,2,3].includes(source.experienceVersion)?source.experienceVersion:1};
 for(const key of ['version','stimulusVersion','protocolVersion','score','maxScore','hits','correctResponses','correctRejections','omissions','falseSelections','longestStreak','durationMs','targetsPerRound','rounds','obstaclesCleared'])if(Number.isFinite(source[key])&&source[key]>=0)result[key]=source[key];
 const choices={gameId:['hunt','ark','space','traffic','search','nback','stroop'],level:['easy','medium','hard'],variant:['standard','divided','signs','scattered','letters','letters-scattered','dual','letters-dual','scattered-dual','letters-scattered-dual','numbers','toys'],feedbackMode:['guided','continuous'],roundFlow:['ready','continuous'],reactionMeasure:['stimulus-onset','search-onset','decision-interval'],stimulusFamily:['star','shape','fish','butterfly','bird']};
 for(const [key,values] of Object.entries(choices)){const value=key==='stimulusFamily'?source[key]||source.settingsSnapshot?.theme:source[key];if(values.includes(value))result[key]=value;}
 if(result.experienceVersion>=3){try{result.timing=validateTiming(result.gameId,source.timing);result.timingKey=timingKey(result.timing);}catch{/* Invalid legacy metadata never enters a timing cohort. */}}
 if(typeof source.trainingProfile?.name==='string'&&source.trainingProfile.name.length<=120&&Number.isSafeInteger(source.trainingProfile.revision)&&source.trainingProfile.revision>0)result.trainingProfile={name:source.trainingProfile.name,revision:source.trainingProfile.revision};
 result.meanReactionMs=Number.isFinite(source.meanReactionMs)&&source.meanReactionMs>=0?source.meanReactionMs:null;
 for(const key of ['completed','departed'])if(typeof source[key]==='boolean')result[key]=source[key];
 if(Number.isFinite(Date.parse(source.finishedAt)))result.finishedAt=new Date(source.finishedAt).toISOString();
 return result;
}

