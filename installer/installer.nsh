; ============================================
; GalacticFS NSIS 安装/卸载钩子（文档 §4.2 右键菜单集成）
; 安装时注册文件 + 文件夹的 "在 GalacticFS 中浏览" 右键菜单；
; 卸载时自动清理注册表（HKCR 需管理员权限，安装向导默认请求）。
; ============================================

!macro customInstall
  WriteRegStr HKCR "*\shell\GalacticFS" "" "在 GalacticFS 中浏览"
  WriteRegStr HKCR "*\shell\GalacticFS" "Icon" "$INSTDIR\GalacticFS.exe,0"
  WriteRegStr HKCR "*\shell\GalacticFS\command" "" '"$INSTDIR\GalacticFS.exe" "--open-path" "%1"'

  WriteRegStr HKCR "Directory\shell\GalacticFS" "" "在 GalacticFS 中浏览"
  WriteRegStr HKCR "Directory\shell\GalacticFS" "Icon" "$INSTDIR\GalacticFS.exe,0"
  WriteRegStr HKCR "Directory\shell\GalacticFS\command" "" '"$INSTDIR\GalacticFS.exe" "--open-path" "%1"'
!macroend

; ============================================
; 卸载时执行的清理脚本（自动取消注册）
; ============================================
!macro customUnInstall
  DeleteRegKey HKCR "*\shell\GalacticFS"
  DeleteRegKey HKCR "Directory\shell\GalacticFS"
!macroend
