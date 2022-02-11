# What

For years (2015 - 2021) I avoided terraform modules. Why? Predominantly for its ability
to handle provider configurations. That sorted out eventually and with 0.15 release my 
nice approach started to break.

It is time to migrate...

But it is tedious 

But even more tedious to maintain the work-arounds.

Can we migrate our old set-up?

# How

You have the structure: 

```
infrastructure/
    common/
        main.tf
        s3.tf
    test/
        backend-config-conf
        terraform.tfvars
    prod/
        backend-config-conf
        terraform.tfvars
    ...     
```

Back in the days (<2021) you would do:

```
cd infrastructure/test
terraform init -backend-config=backend-config.conf ../common
terraform plan -out plan ../commen
```

And so forth.

With 0.15 you had to go:
```
TF_DATA_DIR="$PWD/.terraform" terraform -chdir=../common/ init -backend-config="$PWD/backend-config.conf
TF_DATA_DIR="$PWD/.terraform" t107 -chdir="../common"  plan -out plan -var-file="$PWD/terraform.tfvars
```

Tedious.

If you can, just destroy the shit and start over. But if you have live customers, databases and others
that is not really doable. 

Importing then...

I have started a `nodejs` script to list all resources and convert them.

## Step 1

Copy all .tf files to the different stages

```
cd infrastructure
cp common/*.tf ./test
cp common/*.tf ./prod
...
```

For each stage:
````
cd <stage>
terraform init -backend-config=backend-config.conf
terraform state pull > state.json
````

Make sure you have a clean plan before you start.

Create a new directory named `d2` in infrastructure

```
mkdir -p infrastructure/d2
```

Create a new main.tf in d2 and make sure to copy in your stage variables e.g.

```terraform
module "common" {
  source = "../common"
  
  #< ... your variables from terrafrom.tfvars for your stage ...>
}
```

Copy the stage `input.json` to `d2 e,g,

`cp infrastructure/test/input.json infrastructure/d2`

Run the _no_so_amazing_ `terraform.js` script, it will produce an `import.sh` script in `infrastructure/d2`

You should no be able to run `import.sh` to see if it can import all resources. If not modify `terraform.js` 
accordingly.

When all imports are working, go back to your stage directory and remove all `.tf` files.

Copy the `main.tf` and `import.sh` to your stage directory. Convert `backend-config.conf` to a `variables.tf`:

````terraform
terraform {
  backend "s3" {
    # <-- The content from your backend-config.conf file -->
  }
}
````

**NB** Now it is _very_ important that you select a new state!! The new state should be totally empty.

Make sure to `rm -rf .terraform` and run `tf init`

Then `terraform plan` and make sure all recourses are up for creation. If so, run the `import.sh` script. 

Then there will be a few resources that are missing from the state. Review the plan and **if safe** apply.

Then wash rinse and repeat for all your stages/environments.
