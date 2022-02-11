const fs = require('fs')
const stateFile = fs.readFileSync('./infrastructure/d2/state.json')
const state = JSON.parse(stateFile.toString())

/**
 * Some resources are not importable.
 */
const BLACK_LIST = {
  aws_api_gateway_deployment: true,
  aws_api_gateway_method_settings: true,
  local_file: true
}

/**
 * Some resources require a more complex identifier
 */
const specialName = item => {
  const specials = {
    aws_api_gateway_stage: (itm) =>
      itm.instances[0].attributes.rest_api_id + '/' + itm.instances[0].attributes.stage_name,
    aws_iam_role_policy_attachment: (itm) =>
      itm.instances[0].attributes.role + '/' + itm.instances[0].attributes.policy_arn,
    aws_backup_selection: (itm) =>
      `"${itm.instances[0].attributes.plan_id}|${itm.instances[0].attributes.id}"`,
    aws_lambda_permission: (itm) =>
      `${itm.instances[0].attributes.function_name}/${itm.instances[0].attributes.statement_id}`
  }

  if (specials[item.type]) {
    return specials[item.type](item)
  }
}

const commands = [
  '#!/bin/bash -e',
  '',
  '# Make sure not to glob shit in Windoze',
  'export MSYS_NO_PATHCONV="1"',
  '',
  '# Remove state if we do not have any',
  'rm -rf terraform.tfstate*'
]

state.resources.forEach(item => {
  if (item.mode === 'data') {
    // Data cannot/should not be imported
    // console.log(`${item.mode}.${item.type}.${item.name}`)
  } else if (item.mode === 'managed') {
    if (!BLACK_LIST[item.type]) {
      const multiple = item.instances.length > 1
      item.instances.forEach(instance => {
        const id = specialName(item) || instance.attributes.id || instance.attributes.name || instance.attributes.arn

        // If this resource have multiple instances we need to create one for each with name
        const index = multiple ? `[\\"${instance.index_key}\\"]` : ''

        const command = `terraform import module.common.${item.type}.${item.name}${index} ${id} `
        commands.push(command)
      })

    } else {
      console.log('Cannot import: ' + item.type)
    }
  } else {
    console.log('Unknown:' + item.mode)
  }
})

commands.push('')
commands.push('terraform plan -out plan')

fs.writeFileSync('./infrastructure/d2/import.sh', commands.join('\n'))
