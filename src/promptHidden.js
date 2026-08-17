import readline from 'node:readline';

// Fragt einen Wert interaktiv ab, ohne die Eingabe im Terminal anzuzeigen.
export function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let muted = false;
    const originalWrite = rl._writeToOutput.bind(rl);
    rl._writeToOutput = (str) => {
      if (!muted) originalWrite(str);
    };

    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}
