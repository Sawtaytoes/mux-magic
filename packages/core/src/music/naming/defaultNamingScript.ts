export type NamingOptions = {
  isAsciiOnly: boolean
  isSpaceReplaced: boolean
  isWindowsCompatible: boolean
}

export const DEFAULT_NAMING_SCRIPT =
  "$if2(%albumartist%,%artist%)/$if(%albumartist%,%album%/,)$if($gt(%totaldiscs%,1),$if($gt(%totaldiscs%,9),$num(%discnumber%,2),%discnumber%)-,)$if($and(%albumartist%,%tracknumber%),$num(%tracknumber%,2) ,)$if(%_multiartist%,%artist% - ,)%title%"

export const DEFAULT_NAMING_OPTIONS: NamingOptions = {
  isAsciiOnly: false,
  isSpaceReplaced: false,
  isWindowsCompatible: true,
}
