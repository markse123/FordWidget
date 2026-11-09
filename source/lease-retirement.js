// Move the actual lock before deciding which record may be removed. FileManager
// has no compare-and-delete operation; a mismatched owner must be restored with
// a no-clobber copy or retained at the displaced path for safe recovery.
  retireLease(expected) {
    const displaced = this.lockPath + '.retired.' + uid();
    let moved = false;
    const restore = () => {
      if (!moved || !this.fm.fileExists(displaced)) return;
      try {
        this.fm.copy(displaced, this.lockPath);
        if (this.fm.readString(this.lockPath) === this.fm.readString(displaced)) this.fm.remove(displaced);
      } catch (_) { /* Keep the displaced record; never overwrite a new owner. */ }
    };
    try {
      if (this.fm.fileExists(displaced)) return false;
      this.fm.move(this.lockPath, displaced); moved = true;
      if (JSON.stringify(this.readFile(displaced)) !== JSON.stringify(expected)) { restore(); return false; }
      this.fm.remove(displaced);
      return true;
    } catch (_) { restore(); return false; }
  }
