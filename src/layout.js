/** Fit the board by both dimensions, with no aspect-ratio distortion. */
export function fitBoard(width,height,rows,cols,border=12,gap=2,padding=3){
  const cell=Math.max(1,Math.floor(Math.min((width-border-padding*2-gap*(cols-1))/cols,(height-border-padding*2-gap*(rows-1))/rows)*100)/100);
  return {cell,gap,padding,width:cell*cols+gap*(cols-1)+border+padding*2,height:cell*rows+gap*(rows-1)+border+padding*2};
}
